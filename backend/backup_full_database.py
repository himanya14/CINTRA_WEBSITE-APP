from pathlib import Path
import re

from sqlalchemy import create_engine, MetaData, inspect, text
from sqlalchemy.schema import CreateTable, AddConstraint, CreateIndex


PROJECT = Path(r"C:\Users\himan\OneDrive\Desktop\CINTRA_SIH'26")
ENV_FILE = PROJECT / "backend" / ".env"

OUT_DIR = PROJECT / "database"
OUT_FILE = OUT_DIR / "cintra_database_full.sql"


def read_database_url():
    if not ENV_FILE.exists():
        raise SystemExit(f"Missing {ENV_FILE}")

    for raw in ENV_FILE.read_text(
        encoding="utf-8"
    ).splitlines():

        line = raw.strip()

        if not line or line.startswith("#"):
            continue

        match = re.match(
            r"^DATABASE_URL\s*=\s*(.+)$",
            line
        )

        if match:
            return (
                match.group(1)
                .strip()
                .strip('"')
                .strip("'")
            )

    raise SystemExit(
        "DATABASE_URL not found in backend/.env"
    )


def qident(name):
    return '"' + str(name).replace(
        '"',
        '""'
    ) + '"'


db_url = read_database_url()

engine = create_engine(db_url)

inspector = inspect(engine)

system_schemas = {
    "pg_catalog",
    "information_schema",
}

schemas = [
    schema
    for schema in inspector.get_schema_names()
    if schema not in system_schemas
    and not schema.startswith("pg_toast")
    and not schema.startswith("pg_temp")
]


metadata = MetaData()

for schema in schemas:
    metadata.reflect(
        bind=engine,
        schema=schema,
        views=False,
        extend_existing=True,
    )


OUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


with (
    engine.connect() as conn,
    OUT_FILE.open(
        "w",
        encoding="utf-8",
        newline="\n"
    ) as out
):

    database_name = conn.execute(
        text("SELECT current_database()")
    ).scalar_one()

    out.write(
        "-- CINTRA FULL DATABASE EXPORT\n"
    )

    out.write(
        f"-- Source database: {database_name}\n"
    )

    out.write(
        "-- Generated using Python because "
        "Windows Application Control blocked pg_dump.exe\n\n"
    )

    out.write(
        "SET client_encoding = 'UTF8';\n"
    )

    out.write(
        "SET standard_conforming_strings = on;\n\n"
    )


    # ========================================================
    # EXTENSIONS
    # ========================================================

    extensions = conn.execute(
        text(
            """
            SELECT extname
            FROM pg_extension
            WHERE extname <> 'plpgsql'
            ORDER BY extname
            """
        )
    ).all()

    for (extension,) in extensions:

        out.write(
            f"CREATE EXTENSION IF NOT EXISTS "
            f"{qident(extension)};\n"
        )

    out.write("\n")


    # ========================================================
    # SCHEMAS
    # ========================================================

    for schema in schemas:

        if schema != "public":

            out.write(
                f"CREATE SCHEMA IF NOT EXISTS "
                f"{qident(schema)};\n"
            )

    out.write("\n")


    # ========================================================
    # ENUM TYPES
    # ========================================================

    enums = conn.execute(
        text(
            """
            SELECT
                n.nspname,
                t.typname,
                string_agg(
                    quote_literal(e.enumlabel),
                    ', '
                    ORDER BY e.enumsortorder
                )
            FROM pg_type t
            JOIN pg_enum e
              ON e.enumtypid = t.oid
            JOIN pg_namespace n
              ON n.oid = t.typnamespace
            WHERE n.nspname NOT IN (
                'pg_catalog',
                'information_schema'
            )
            AND n.nspname NOT LIKE 'pg_toast%'
            AND n.nspname NOT LIKE 'pg_temp%'
            GROUP BY
                n.nspname,
                t.typname
            ORDER BY
                n.nspname,
                t.typname
            """
        )
    ).all()

    for schema, type_name, labels in enums:

        out.write(
            "DO $$ BEGIN\n"
        )

        out.write(
            f"CREATE TYPE "
            f"{qident(schema)}."
            f"{qident(type_name)} "
            f"AS ENUM ({labels});\n"
        )

        out.write(
            "EXCEPTION WHEN duplicate_object "
            "THEN NULL;\n"
            "END $$;\n"
        )

    out.write("\n")


    # ========================================================
    # SEQUENCES
    # ========================================================

    sequences = conn.execute(
        text(
            """
            SELECT
                schemaname,
                sequencename,
                start_value,
                min_value,
                max_value,
                increment_by,
                cycle,
                cache_size,
                last_value
            FROM pg_sequences
            WHERE schemaname NOT IN (
                'pg_catalog',
                'information_schema'
            )
            AND schemaname NOT LIKE 'pg_toast%'
            AND schemaname NOT LIKE 'pg_temp%'
            ORDER BY
                schemaname,
                sequencename
            """
        )
    ).mappings().all()


    for sequence in sequences:

        out.write(
            f"CREATE SEQUENCE IF NOT EXISTS "
            f"{qident(sequence['schemaname'])}."
            f"{qident(sequence['sequencename'])}"
            f" INCREMENT BY "
            f"{sequence['increment_by']}"
            f" MINVALUE "
            f"{sequence['min_value']}"
            f" MAXVALUE "
            f"{sequence['max_value']}"
            f" START WITH "
            f"{sequence['start_value']}"
            f" CACHE "
            f"{sequence['cache_size']}"
        )

        if sequence["cycle"]:

            out.write(
                " CYCLE;\n"
            )

        else:

            out.write(
                " NO CYCLE;\n"
            )

    out.write("\n")


    # ========================================================
    # TABLE STRUCTURE
    # ========================================================

    tables = list(
        metadata.sorted_tables
    )

    for table in tables:

        ddl = str(
            CreateTable(
                table,
                include_foreign_key_constraints=[]
            ).compile(
                dialect=engine.dialect
            )
        ).rstrip()

        out.write(
            ddl + ";\n\n"
        )


    # ========================================================
    # ALL TABLE DATA
    # ========================================================

    for table in tables:

        schema = (
            table.schema
            or "public"
        )

        table_name = table.name

        columns = conn.execute(
            text(
                """
                SELECT
                    a.attname,
                    format_type(
                        a.atttypid,
                        a.atttypmod
                    )
                FROM pg_attribute a

                JOIN pg_class c
                    ON c.oid = a.attrelid

                JOIN pg_namespace n
                    ON n.oid = c.relnamespace

                WHERE n.nspname = :schema
                  AND c.relname = :table_name
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                  AND a.attgenerated = ''

                ORDER BY a.attnum
                """
            ),
            {
                "schema": schema,
                "table_name": table_name,
            }
        ).all()

        if not columns:
            continue


        column_names = ", ".join(
            qident(name)
            for name, _ in columns
        )


        literal_parts = []

        for column_name, column_type in columns:

            column = qident(
                column_name
            )

            literal_parts.append(
                f"CASE "
                f"WHEN {column} IS NULL "
                f"THEN 'NULL' "
                f"ELSE quote_literal("
                f"{column}::text"
                f") || '::{column_type}' "
                f"END"
            )


        row_expression = (
            " || ', ' || "
        ).join(
            literal_parts
        )


        generator = f"""
        SELECT
            'INSERT INTO
            {qident(schema)}.
            {qident(table_name)}
            ({column_names})
            OVERRIDING SYSTEM VALUE
            VALUES ('
            || {row_expression}
            || ');'
        FROM
            {qident(schema)}.
            {qident(table_name)}
        """


        # Remove whitespace introduced by
        # Python formatting inside INSERT prefix
        generator = generator.replace(
            "'INSERT INTO\n            ",
            "'INSERT INTO "
        )

        generator = generator.replace(
            "\n            (",
            " ("
        )

        generator = generator.replace(
            "\n            OVERRIDING",
            " OVERRIDING"
        )

        generator = generator.replace(
            "\n            VALUES",
            " VALUES"
        )


        out.write(
            f"-- DATA: "
            f"{schema}.{table_name}\n"
        )


        result = conn.execution_options(
            stream_results=True
        ).execute(
            text(generator)
        )


        count = 0

        for (insert_statement,) in result:

            out.write(
                insert_statement + "\n"
            )

            count += 1


        out.write(
            f"-- {count} row(s)\n\n"
        )


    # ========================================================
    # FOREIGN KEYS
    # ========================================================

    for table in tables:

        for foreign_key in (
            table.foreign_key_constraints
        ):

            ddl = str(
                AddConstraint(
                    foreign_key
                ).compile(
                    dialect=engine.dialect
                )
            ).rstrip()

            out.write(
                ddl + ";\n"
            )

    out.write("\n")


    # ========================================================
    # INDEXES
    # ========================================================

    for table in tables:

        indexes = sorted(
            table.indexes,
            key=lambda index:
                index.name or ""
        )

        for index in indexes:

            try:

                ddl = str(
                    CreateIndex(
                        index
                    ).compile(
                        dialect=engine.dialect
                    )
                ).rstrip()

                out.write(
                    ddl + ";\n"
                )

            except Exception as error:

                out.write(
                    f"-- Index "
                    f"{index.name} "
                    f"could not be rendered: "
                    f"{error}\n"
                )

    out.write("\n")


    # ========================================================
    # RESET SEQUENCES
    # ========================================================

    for sequence in sequences:

        last_value = (
            sequence["last_value"]
        )

        if last_value is None:
            continue

        sequence_name = (
            f"{qident(sequence['schemaname'])}."
            f"{qident(sequence['sequencename'])}"
        ).replace(
            "'",
            "''"
        )

        out.write(
            f"SELECT setval("
            f"'{sequence_name}'::regclass, "
            f"{int(last_value)}, "
            f"true"
            f");\n"
        )

    out.write("\n")


    # ========================================================
    # USER DEFINED FUNCTIONS
    # ========================================================

    functions = conn.execute(
        text(
            """
            SELECT
                pg_get_functiondef(p.oid)

            FROM pg_proc p

            JOIN pg_namespace n
                ON n.oid = p.pronamespace

            WHERE n.nspname NOT IN (
                'pg_catalog',
                'information_schema'
            )

            AND n.nspname NOT LIKE
                'pg_toast%'

            AND n.nspname NOT LIKE
                'pg_temp%'

            ORDER BY
                n.nspname,
                p.proname,
                p.oid
            """
        )
    ).all()


    for (function_definition,) in functions:

        if function_definition:

            out.write(
                function_definition.rstrip()
                + "\n\n"
            )


    # ========================================================
    # VIEWS
    # ========================================================

    views = conn.execute(
        text(
            """
            SELECT
                schemaname,
                viewname,
                definition

            FROM pg_views

            WHERE schemaname NOT IN (
                'pg_catalog',
                'information_schema'
            )

            AND schemaname NOT LIKE
                'pg_toast%'

            AND schemaname NOT LIKE
                'pg_temp%'

            ORDER BY
                schemaname,
                viewname
            """
        )
    ).all()


    for schema, view_name, definition in views:

        out.write(
            f"CREATE OR REPLACE VIEW "
            f"{qident(schema)}."
            f"{qident(view_name)} AS\n"
        )

        out.write(
            definition.rstrip()
            + "\n\n"
        )


    # ========================================================
    # MATERIALIZED VIEWS
    # ========================================================

    materialized_views = conn.execute(
        text(
            """
            SELECT
                schemaname,
                matviewname,
                definition

            FROM pg_matviews

            WHERE schemaname NOT IN (
                'pg_catalog',
                'information_schema'
            )

            AND schemaname NOT LIKE
                'pg_toast%'

            AND schemaname NOT LIKE
                'pg_temp%'

            ORDER BY
                schemaname,
                matviewname
            """
        )
    ).all()


    for (
        schema,
        view_name,
        definition
    ) in materialized_views:

        out.write(
            f"CREATE MATERIALIZED VIEW "
            f"{qident(schema)}."
            f"{qident(view_name)} AS\n"
        )

        out.write(
            definition.rstrip()
            + "\nWITH DATA;\n\n"
        )


    # ========================================================
    # TRIGGERS
    # ========================================================

    triggers = conn.execute(
        text(
            """
            SELECT
                pg_get_triggerdef(
                    t.oid,
                    true
                )

            FROM pg_trigger t

            JOIN pg_class c
                ON c.oid = t.tgrelid

            JOIN pg_namespace n
                ON n.oid = c.relnamespace

            WHERE NOT t.tgisinternal

            AND n.nspname NOT IN (
                'pg_catalog',
                'information_schema'
            )

            AND n.nspname NOT LIKE
                'pg_toast%'

            AND n.nspname NOT LIKE
                'pg_temp%'

            ORDER BY
                n.nspname,
                c.relname,
                t.tgname
            """
        )
    ).all()


    for (trigger_definition,) in triggers:

        if trigger_definition:

            out.write(
                trigger_definition.rstrip()
                + ";\n"
            )


print()
print("==========================================")
print("FULL CINTRA DATABASE BACKUP CREATED")
print("==========================================")
print(OUT_FILE)
print()
print(
    f"Size: "
    f"{OUT_FILE.stat().st_size:,} bytes"
)
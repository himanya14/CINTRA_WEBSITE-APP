import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";


GlobalWorkerOptions.workerSrc =
  pdfWorker;


/* =========================================================
   GENERIC HELPERS
   ========================================================= */

const MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};


function pickField(
  record,
  possibilities
) {
  for (
    const key of possibilities
  ) {
    const value =
      record?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}


function parseDuration(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }


  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }


  const text =
    String(value).trim();


  /*
   * Plain number = seconds
   */

  if (
    /^\d+(\.\d+)?$/.test(
      text
    )
  ) {
    return Number(text);
  }


  /*
   * 02m 18s
   */

  const minuteSecond =
    text.match(
      /(\d+)\s*m(?:in)?\s*(\d+)\s*s(?:ec)?/i
    );

  if (minuteSecond) {
    return (
      Number(
        minuteSecond[1]
      ) *
        60 +
      Number(
        minuteSecond[2]
      )
    );
  }


  /*
   * 02:18
   * 00:02:18
   */

  const colonParts =
    text
      .split(":")
      .map(Number);


  if (
    colonParts.length === 2 &&
    colonParts.every(
      Number.isFinite
    )
  ) {
    return (
      colonParts[0] * 60 +
      colonParts[1]
    );
  }


  if (
    colonParts.length === 3 &&
    colonParts.every(
      Number.isFinite
    )
  ) {
    return (
      colonParts[0] * 3600 +
      colonParts[1] * 60 +
      colonParts[2]
    );
  }


  return 0;
}


function buildIsoTimestamp(
  day,
  monthName,
  year,
  time
) {
  const month =
    MONTHS[
      String(
        monthName
      ).toLowerCase()
    ];


  if (!month) {
    return null;
  }


  return `${year}-${month}-${String(
    day
  ).padStart(
    2,
    "0"
  )}T${time}:00`;
}


/* =========================================================
   CSV
   ========================================================= */

function parseCSVLine(line) {
  const values = [];

  let current = "";
  let quoted = false;


  for (
    let index = 0;
    index < line.length;
    index += 1
  ) {
    const character =
      line[index];


    if (
      character === "\""
    ) {
      if (
        quoted &&
        line[index + 1] ===
          "\""
      ) {
        current += "\"";
        index += 1;
      } else {
        quoted =
          !quoted;
      }

      continue;
    }


    if (
      character === "," &&
      !quoted
    ) {
      values.push(
        current.trim()
      );

      current = "";

      continue;
    }


    current += character;
  }


  values.push(
    current.trim()
  );

  return values;
}


function parseCSV(text) {
  const lines =
    text
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.trim()
      );


  if (
    lines.length < 2
  ) {
    return [];
  }


  const headers =
    parseCSVLine(
      lines[0]
    ).map(
      (header) =>
        header
          .trim()
          .toLowerCase()
    );


  return lines
    .slice(1)
    .map(
      (line) => {
        const values =
          parseCSVLine(
            line
          );

        const record = {};


        headers.forEach(
          (
            header,
            index
          ) => {
            record[header] =
              values[index] ??
              "";
          }
        );


        return record;
      }
    );
}


/* =========================================================
   NORMALISE JSON / CSV RECORDS
   ========================================================= */

function normalizeStructuredRecords(
  records
) {
  if (
    !Array.isArray(records)
  ) {
    return [];
  }


  return records.map(
    (
      record,
      index
    ) => {
      const date =
        pickField(
          record,
          [
            "date",
            "call_date",
          ]
        );

      const time =
        pickField(
          record,
          [
            "time",
            "call_time",
          ]
        );


      let timestamp =
        pickField(
          record,
          [
            "timestamp",
            "datetime",
            "date_time",
            "started_at",
            "start_time",
          ]
        );


      if (
        !timestamp &&
        date &&
        time
      ) {
        timestamp =
          `${date} ${time}`;
      }


      return {
        id:
          record.id ??
          index + 1,

        from:
          pickField(
            record,
            [
              "from",
              "caller",
              "caller_number",
              "source",
              "source_number",
              "a_number",
            ]
          ),

        to:
          pickField(
            record,
            [
              "to",
              "callee",
              "called_number",
              "target",
              "destination",
              "destination_number",
              "b_number",
            ]
          ),

        timestamp,

        duration:
          parseDuration(
            pickField(
              record,
              [
                "duration",
                "duration_seconds",
                "call_duration",
              ]
            )
          ),

        type:
          pickField(
            record,
            [
              "type",
              "call_type",
              "communication_type",
            ]
          ) ||
          "Communication",
      };
    }
  );
}


/* =========================================================
   PDF TEXT EXTRACTION
   ========================================================= */

async function extractPdfLines(
  arrayBuffer
) {
  const loadingTask =
    getDocument({
      data:
        new Uint8Array(
          arrayBuffer
        ),
    });


  const pdf =
    await loadingTask.promise;


  const documentLines = [];


  for (
    let pageNumber = 1;
    pageNumber <=
    pdf.numPages;
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );


    const content =
      await page.getTextContent();


    const buckets = [];


    content.items.forEach(
      (item) => {
        const text =
          String(
            item.str || ""
          ).trim();


        if (!text) {
          return;
        }


        const x =
          Number(
            item.transform?.[4] ||
              0
          );

        const y =
          Number(
            item.transform?.[5] ||
              0
          );


        let bucket =
          buckets.find(
            (current) =>
              Math.abs(
                current.y - y
              ) < 2.5
          );


        if (!bucket) {
          bucket = {
            y,
            items: [],
          };

          buckets.push(
            bucket
          );
        }


        bucket.items.push({
          x,
          text,
        });
      }
    );


    const pageLines =
      buckets
        .sort(
          (a, b) =>
            b.y - a.y
        )
        .map(
          (bucket) =>
            bucket.items
              .sort(
                (a, b) =>
                  a.x - b.x
              )
              .map(
                (item) =>
                  item.text
              )
              .join(" ")
              .replace(
                /\s+/g,
                " "
              )
              .trim()
        )
        .filter(Boolean);


    documentLines.push(
      ...pageLines
    );
  }


  return documentLines;
}


/* =========================================================
   PDF SUBSCRIBERS
   ========================================================= */

function extractSubscribers(
  lines
) {
  const subscribers =
    new Map();


  lines.forEach(
    (line) => {
      /*
       * Example:
       *
       * SUB-DEMO-001 Ravi Mehra 9876501001
       */

      const match =
        line.match(
          /\bSUB-[A-Za-z0-9-]+\b\s+(.+?)\s+(\d{10,15})\b/i
        );


      if (!match) {
        return;
      }


      const name =
        match[1]
          .trim()
          .replace(
            /\s+/g,
            " "
          );

      const number =
        match[2];


      if (
        name &&
        number
      ) {
        subscribers.set(
          name,
          number
        );
      }
    }
  );


  return subscribers;
}


/* =========================================================
   PDF COMMUNICATION ROWS
   ========================================================= */

function extractCommunicationRecords(
  lines,
  subscribers
) {
  const records = [];


  lines.forEach(
    (line) => {
      /*
       * Expected beginning:
       *
       * 01 Sep 2026 09:12
       */

      const dateMatch =
        line.match(
          /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}:\d{2})\s+(.+)$/i
        );


      if (!dateMatch) {
        return;
      }


      const [
        ,
        day,
        month,
        year,
        time,
        originalBody,
      ] = dateMatch;


      let body =
        originalBody
          .trim()
          .replace(
            /\s+/g,
            " "
          );


      /*
       * Duration at end:
       * 02m 18s
       */

      const durationMatch =
        body.match(
          /(\d+)\s*m\s*(\d+)\s*s\s*$/i
        );


      let duration = 0;


      if (durationMatch) {
        duration =
          Number(
            durationMatch[1]
          ) *
            60 +
          Number(
            durationMatch[2]
          );


        body =
          body
            .slice(
              0,
              durationMatch.index
            )
            .trim();
      }


      /*
       * Detect communication type.
       */

      const knownTypes = [
        "Voice Call",
        "Incoming Call",
        "Outgoing Call",
        "Missed Call",
        "SMS",
        "Data Session",
      ];


      let type =
        "Communication";


      for (
        const candidate of
        knownTypes
      ) {
        const lowerBody =
          body.toLowerCase();

        const lowerCandidate =
          candidate.toLowerCase();

        if (
          lowerBody.endsWith(
            lowerCandidate
          )
        ) {
          type =
            candidate;

          body =
            body
              .slice(
                0,
                body.length -
                  candidate.length
              )
              .trim();

          break;
        }
      }


      /*
       * First try phone numbers directly.
       */

      const phoneMatches =
        body.match(
          /\b\d{10,15}\b/g
        );


      let caller = null;
      let callee = null;


      if (
        phoneMatches &&
        phoneMatches.length >= 2
      ) {
        caller =
          phoneMatches[0];

        callee =
          phoneMatches[1];
      } else {
        /*
         * The CINTRA demo PDF uses names in the
         * communication log, while its subscriber
         * table maps those names to numbers.
         */

        const namesFound =
          Array.from(
            subscribers.keys()
          )
            .map(
              (name) => ({
                name,
                index:
                  body.indexOf(
                    name
                  ),
              })
            )
            .filter(
              (entry) =>
                entry.index >= 0
            )
            .sort(
              (a, b) =>
                a.index -
                b.index
            );


        if (
          namesFound.length >=
          2
        ) {
          caller =
            subscribers.get(
              namesFound[0].name
            );

          callee =
            subscribers.get(
              namesFound[1].name
            );
        }
      }


      if (
        !caller ||
        !callee
      ) {
        return;
      }


      const timestamp =
        buildIsoTimestamp(
          day,
          month,
          year,
          time
        );


      if (!timestamp) {
        return;
      }


      records.push({
        id:
          records.length + 1,

        from:
          caller,

        to:
          callee,

        timestamp,

        duration,

        type,
      });
    }
  );


  return records;
}


/* =========================================================
   PDF PARSER
   ========================================================= */

async function parsePdfCDR(
  arrayBuffer
) {
  const lines =
    await extractPdfLines(
      arrayBuffer
    );


  const subscribers =
    extractSubscribers(
      lines
    );


  const records =
    extractCommunicationRecords(
      lines,
      subscribers
    );


  if (
    records.length === 0
  ) {
    throw new Error(
      "The PDF opened successfully, but CINTRA could not identify structured communication rows."
    );
  }


  return records;
}


/* =========================================================
   PUBLIC FILE PARSER
   ========================================================= */

export async function parseCDRFile(
  arrayBuffer,
  extension
) {
  const ext =
    String(
      extension || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /^\./,
        ""
      );


  if (ext === "pdf") {
    return parsePdfCDR(
      arrayBuffer
    );
  }


  const text =
    new TextDecoder(
      "utf-8"
    ).decode(
      arrayBuffer
    );


  if (ext === "csv") {
    return normalizeStructuredRecords(
      parseCSV(text)
    );
  }


  if (ext === "json") {
    let data;

    try {
      data =
        JSON.parse(text);
    } catch {
      throw new Error(
        "The attached JSON file is not valid JSON."
      );
    }


    const rawRecords =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data?.records
          )
          ? data.records
          : Array.isArray(
              data?.calls
            )
            ? data.calls
            : [];


    return normalizeStructuredRecords(
      rawRecords
    );
  }


  throw new Error(
    "CDR analysis supports PDF, CSV, or JSON evidence files."
  );
}


/* =========================================================
   ANALYTICS
   ========================================================= */

export function analyzeCDRRecords(
  records
) {
  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return null;
  }


  const contacts =
    new Set();

  const connections =
    new Map();

  const hourlyActivity =
    new Map();

  let totalDuration = 0;


  records.forEach(
    (record) => {
      if (record.from) {
        contacts.add(
          String(
            record.from
          )
        );
      }


      if (record.to) {
        contacts.add(
          String(
            record.to
          )
        );
      }


      if (
        record.from &&
        record.to
      ) {
        const connection =
          [
            String(
              record.from
            ),
            String(
              record.to
            ),
          ]
            .sort()
            .join(" ↔ ");


        connections.set(
          connection,
          (
            connections.get(
              connection
            ) || 0
          ) + 1
        );
      }


      const duration =
        Number(
          record.duration
        );


      if (
        Number.isFinite(
          duration
        )
      ) {
        totalDuration +=
          duration;
      }


      if (
        record.timestamp
      ) {
        const timestamp =
          new Date(
            record.timestamp
          );


        if (
          !Number.isNaN(
            timestamp.getTime()
          )
        ) {
          const hour =
            timestamp.getHours();


          hourlyActivity.set(
            hour,
            (
              hourlyActivity.get(
                hour
              ) || 0
            ) + 1
          );
        }
      }
    }
  );


  const topPair =
    Array.from(
      connections.entries()
    ).sort(
      (a, b) =>
        b[1] - a[1]
    )[0] || null;


  const hourEntries =
    Array.from(
      hourlyActivity.entries()
    );


  const maxHourCount =
    hourEntries.length
      ? Math.max(
          ...hourEntries.map(
            ([, count]) =>
              count
          )
        )
      : 0;


  const peakHours =
    hourEntries
      .filter(
        ([, count]) =>
          count ===
          maxHourCount
      )
      .map(
        ([hour]) =>
          hour
      )
      .sort(
        (a, b) =>
          a - b
      );


  return {
    totalRecords:
      records.length,

    uniqueContacts:
      contacts.size,

    totalDuration,

    topPair,

    peakHours,

    peakCount:
      maxHourCount,
  };
}
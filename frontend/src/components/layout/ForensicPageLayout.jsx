import AppHeader from "./AppHeader.jsx";


function ForensicPageLayout({
  module = "overview",
  children,
}) {
  return (
    <div className="forensic-layout">

      <AppHeader
        activePage={module}
      />


      <main className="forensic-main-workspace">

        {children}

      </main>

    </div>
  );
}


export default ForensicPageLayout;

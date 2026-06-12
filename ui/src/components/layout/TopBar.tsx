const TopBar = () => {
  return (
    <header
      style={{
        position: "relative",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "16px",
        height: "60px",
        padding: "0 24px",
        backgroundColor: "#0f172a",
        borderBottom: "1px solid #1e293b",
      }}
    >
      {/* Search input */}
      {/* <input
        type="text"
        placeholder="Search…"
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #475569',
          borderRadius: '6px',
          color: '#f8fafc',
          padding: '6px 12px',
          fontSize: '14px',
          outline: 'none',
          width: '220px',
        }}
      /> */}

      {/* Notifications icon button */}
      {/* <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '50%',
        }}
      >
        <span className="material-icons">notifications</span>
      </button> */}

      {/* Avatar */}
      {/* <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#0ea5e9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        AD
      </div> */}
    </header>
  );
};

export default TopBar;

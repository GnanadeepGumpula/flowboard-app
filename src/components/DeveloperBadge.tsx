import React from "react";

const DeveloperBadge: React.FC = () => {
  // Just use regular React state. No localStorage, no sessionStorage.
  const [dismissed, setDismissed] = React.useState(false);

  const handleDismiss = () => {
    setDismissed(true);
  };

  // If they clicked cancel, hide it for this specific page view
  if (dismissed) return null;

  return (
    <div style={styles.badge}>
      <a
        href="https://gnanadeepstudio.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        style={styles.link}
      >
        <div style={styles.profilePicContainer}>
          <img src="/gnanadeep.jpeg" alt="Gnanadeep Gumpula" style={styles.profilePic} />
        </div>
        <span style={styles.text}>Build by Gnanadeep Gumpula</span>
      </a>
      <button type="button" onClick={handleDismiss} style={styles.dismiss} aria-label="Dismiss developer badge">
        ×
      </button>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  badge: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
    padding: "8px 10px 8px 8px",
    borderRadius: "30px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "13px",
    fontWeight: 500,
    zIndex: 9999,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    border: "1px solid rgba(0, 0, 0, 0.05)",
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    color: "inherit",
  },
  profilePicContainer: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  profilePic: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  text: {
    whiteSpace: "nowrap",
  },
  dismiss: {
    border: "none",
    background: "transparent",
    color: "#666",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: 1,
    padding: 0,
  },
};

export default DeveloperBadge;
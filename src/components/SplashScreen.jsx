import StatusBar from "./StatusBar.jsx";
import "./SplashScreen.css";

export default function SplashScreen({ onContinue }) {
  return (
    <button
      type="button"
      className="screen"
      onClick={onContinue}
      aria-label="Sigma – Quality Control Management System"
    >
      <StatusBar />

      <div className="logo-block">
        <img className="logo-img" src="/logo.png" alt="Sigma logo" />
        <p className="tagline">
          System Inspection 
          <br />
          Garment Monitoring and Analysis
        </p>
      </div>
    </button>
  );
}

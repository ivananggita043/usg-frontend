export default function Logo ({ size = 64, className = "" }) {
    return (
        <img
        src="."
        alt="Dress-2 logo"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: "contain", display: "block" }}
        />
    );
}
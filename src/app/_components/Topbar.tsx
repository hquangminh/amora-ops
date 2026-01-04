import Image from "next/image";
import Link from "next/link";

type Props = {
  title: string;
  right?: React.ReactNode;
  backHref?: string;
};

export default function Topbar({ title, right, backHref }: Props) {
  return (
    <div className="topbar">
      <div className="brand" style={{ gap: 12 }}>
        <Image
          src="/brand/amora-logo.png"
          alt="Amora"
          width={140}
          height={44}
          priority
          style={{ height: 36, width: "auto", objectFit: "contain" }}
        />

        <div
          style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}
        >
          <span style={{ fontWeight: 800, letterSpacing: 0.2 }}>{title}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            Simple moments. Deep calm.
          </span>
        </div>
      </div>

      <div className="row" style={{ alignItems: "center" }}>
        {backHref ? (
          <Link className="btn" href={backHref}>
            ←
          </Link>
        ) : null}
        {right}
      </div>
    </div>
  );
}

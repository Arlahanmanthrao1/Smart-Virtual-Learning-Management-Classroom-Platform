import { useEffect } from "react";
import brand from "./brand.json";
import "./brand.css";

export { brand };

export function pageTitle(page, institution) {
  return [...new Set([page, institution, brand.name].filter(Boolean))].join(" · ");
}

export function usePageTitle(page, institution) {
  useEffect(() => { document.title = pageTitle(page, institution); }, [page, institution]);
}

export function BrandMark({ size = 40, className = "" }) {
  return <img className={`platform-mark ${className}`} src="/brand-mark.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

export function BrandLogo({ inverse = false, compact = false }) {
  return <span className={`platform-logo ${inverse ? "platform-logo-inverse" : ""}`}>
    <BrandMark /><span className="platform-wordmark">{compact ? brand.shortName : brand.name}</span>
  </span>;
}

export function BrandLoading({ children = "Loading your learning space…" }) {
  return <div className="loading-screen" role="status"><BrandMark size={58} /><p>{children}</p></div>;
}

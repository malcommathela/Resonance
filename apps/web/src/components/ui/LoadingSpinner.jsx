import * as React from "react";

/*
  GooeyLoader — NovaFlow design system
  Primary: #DCFC5C (brand lime)
  Secondary: #9CA3AF (brand gray)
  Border: theme-aware via rgb(var(--border-color-rgb))

  Usage:
    <GooeyLoader message="Configuring your account..." />
    <LoadingSpinner size="lg" message="Loading your designs..." />
    <LoadingPage message="Please wait while we prepare everything for you" />
*/

export const GooeyLoader = React.forwardRef(
  ({ className = "", primaryColor, secondaryColor, borderColor, message, ...props }, ref) => {
    // NovaFlow design system defaults — never assume shadcn variables
    const style = {
      "--gooey-primary-color": primaryColor || "#DCFC5C",
      "--gooey-secondary-color": secondaryColor || "#9CA3AF",
      "--gooey-border-color": borderColor || "rgb(var(--border-color-rgb))",
    };

    return (
      <div
        ref={ref}
        className={`relative flex flex-col items-center justify-center gap-5 ${className}`}
        style={style}
        role="status"
        aria-label="Loading"
        {...props}
      >
        {/* SVG filter for the gooey effect */}
        <svg className="absolute w-0 h-0">
          <defs>
            <filter id="gooey-loader-filter">
              <feGaussianBlur in="SourceGraphic" stdDeviation={12} result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 48 -7"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        <style>
          {`
            .gooey-loader {
              width: 12em;
              height: 3em;
              position: relative;
              overflow: hidden;
              border-bottom: 8px solid var(--gooey-border-color);
              filter: url(#gooey-loader-filter);
            }

            .gooey-loader::before,
            .gooey-loader::after {
              content: '';
              position: absolute;
              border-radius: 50%;
            }

            .gooey-loader::before {
              width: 22em;
              height: 18em;
              background-color: var(--gooey-primary-color);
              left: -2em;
              bottom: -18em;
              animation: gooey-loader-wee1 2s linear infinite;
            }

            .gooey-loader::after {
              width: 16em;
              height: 12em;
              background-color: var(--gooey-secondary-color);
              left: -4em;
              bottom: -12em;
              animation: gooey-loader-wee2 2s linear infinite 0.75s;
            }

            @keyframes gooey-loader-wee1 {
              0% { transform: translateX(-10em) rotate(0deg); }
              100% { transform: translateX(7em) rotate(180deg); }
            }

            @keyframes gooey-loader-wee2 {
              0% { transform: translateX(-8em) rotate(0deg); }
              100% { transform: translateX(8em) rotate(180deg); }
            }
          `}
        </style>

        <div className="gooey-loader" />

        {message && (
          <p className="text-sm font-medium text-resonance-text-secondary animate-pulse text-center max-w-xs leading-relaxed">
            {message}
          </p>
        )}
      </div>
    );
  }
);
GooeyLoader.displayName = "GooeyLoader";

/* ------------------------------------------------------------------ */
// Backward-compatible spinner with size variants
/* ------------------------------------------------------------------ */

export const LoadingSpinner = ({ size = "md", className = "", message }) => {
  // Scale via font-size because the gooey loader uses em units
  const sizeClasses = {
    sm: "text-[6px]",
    md: "text-[10px]",
    lg: "text-[14px]",
    xl: "text-[18px]",
  };

  return (
    <GooeyLoader
      className={`${sizeClasses[size] || sizeClasses.md} ${className}`}
      message={message}
    />
  );
};

/* ------------------------------------------------------------------ */
// Full-page loading screen with contextual message
/* ------------------------------------------------------------------ */

export const LoadingPage = ({ message = "Loading..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-resonance-bg-primary">
    <LoadingSpinner size="lg" message={message} />
  </div>
);

/* ------------------------------------------------------------------ */
// Scenario-specific loaders (convenience exports)
/* ------------------------------------------------------------------ */

export const AuthLoadingPage = () => (
  <LoadingPage message="Configuring your account..." />
);

export const DesignLoadingPage = () => (
  <LoadingPage message="Loading design details..." />
);

export const CanvasLoadingPage = () => (
  <LoadingPage message="Preparing canvas editor..." />
);

export const ReportLoadingPage = () => (
  <LoadingPage message="Loading simulation reports..." />
);

export const SettingsLoadingPage = () => (
  <LoadingPage message="Please wait while we prepare everything for you..." />
);
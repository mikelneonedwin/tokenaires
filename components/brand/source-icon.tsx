import { useId } from "react";
import type { AgentSource } from "@tokenaires/contracts";
import { AGENT_SOURCE_LABELS } from "@tokenaires/contracts";
import type { IconBaseProps, IconType } from "react-icons";
import { RiOpenaiFill } from "react-icons/ri";
import { SiClaude, SiCline, SiDeepseek, SiGithubcopilot, SiGooglegemini, SiMoonshotai, SiOpencode, SiQwen, SiZedindustries } from "react-icons/si";
import { VscVscode } from "react-icons/vsc";
import { cn } from "@/lib/utils";

function AntigravityIcon({ className, ...props }: IconBaseProps) {
  const id = useId();
  const maskId = `ag-mask-${id}`;
  const f = (n: number) => `ag-f-${n}-${id}`;

  return (
    <svg viewBox="16 16 148 148" fill="none" className={className} {...props}>
      <path
        d="M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625C121.748 110.625 128.31 28.125 89.8727 28.125C51.4352 28.125 57.9977 110.625 27.0602 140.625C15.8102 151.875 27.9977 154.688 35.4977 149.062C64.5602 129.375 62.6852 94.6875 89.8727 94.6875C117.06 94.6875 115.185 129.375 144.248 149.062Z"
        fill="#3186FF"
      />
      <mask id={maskId} style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="22" y="28" width="136" height="125">
        <path
          d="M144.248 149.062C151.748 154.688 162.998 150.938 152.685 140.625C121.748 110.625 128.31 28.125 89.8727 28.125C51.4352 28.125 57.9977 110.625 27.0602 140.625C15.8102 151.875 27.9977 154.688 35.4977 149.062C64.5602 129.375 62.6852 94.6875 89.8727 94.6875C117.06 94.6875 115.185 129.375 144.248 149.062Z"
          fill="white"
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <g filter={`url(#${f(0)})`}>
          <ellipse cx="36.6225" cy="43.0872" rx="36.6225" ry="43.0872" transform="matrix(-0.112784 0.99362 -0.99362 -0.112781 106.557 -26.4847)" fill="#FFE432" />
        </g>
        <g filter={`url(#${f(1)})`}>
          <ellipse cx="155.163" cy="54.9292" rx="47.4118" ry="48.4541" transform="rotate(76.9243 155.163 54.9292)" fill="#FC413D" />
        </g>
        <g filter={`url(#${f(2)})`}>
          <ellipse cx="14.6006" cy="65.4425" rx="49.5515" ry="64.192" transform="rotate(74.1257 14.6006 65.4425)" fill="#00B95C" />
        </g>
        <g filter={`url(#${f(3)})`}>
          <ellipse cx="14.6006" cy="65.4425" rx="49.5515" ry="64.192" transform="rotate(74.1257 14.6006 65.4425)" fill="#00B95C" />
        </g>
        <g filter={`url(#${f(4)})`}>
          <ellipse cx="18.1226" cy="67.414" rx="48.5679" ry="53.4688" transform="rotate(45.6065 18.1226 67.414)" fill="#00B95C" />
        </g>
        <g filter={`url(#${f(5)})`}>
          <ellipse cx="121.837" cy="166.945" rx="46.6356" ry="44.9084" transform="rotate(76.9243 121.837 166.945)" fill="#3186FF" />
        </g>
        <g filter={`url(#${f(6)})`}>
          <ellipse cx="53.9456" cy="56.8997" rx="53.9456" ry="56.8997" transform="matrix(-0.409539 0.912293 -0.912294 -0.409537 162.811 -25.895)" fill="#FBBC04" />
        </g>
        <g filter={`url(#${f(7)})`}>
          <path d="M4.21557 239.063C-25.3231 227.467 25.1577 132.061 37.7105 100.085C50.2634 68.1097 84.3853 51.5888 113.924 63.1848C143.463 74.7809 178.474 138.65 165.921 170.626C153.368 202.601 33.7543 250.659 4.21557 239.063Z" fill="#3186FF" />
        </g>
        <g filter={`url(#${f(8)})`}>
          <path d="M183.197 120.315C175.289 129.545 154.652 124.839 137.102 109.803C119.553 94.7668 111.738 75.0955 119.646 65.8656C127.554 56.6357 148.191 61.3423 165.74 76.3782C183.289 91.414 191.105 111.085 183.197 120.315Z" fill="#749BFF" />
        </g>
        <g filter={`url(#${f(9)})`}>
          <ellipse cx="148.928" cy="36.7252" rx="71.1018" ry="44.199" transform="rotate(34.0763 148.928 36.7252)" fill="#FC413D" />
        </g>
        <g filter={`url(#${f(10)})`}>
          <ellipse cx="37.848" cy="46.0346" rx="38.1008" ry="22.1575" transform="rotate(112.516 37.848 46.0346)" fill="#FFEE48" />
        </g>
      </g>
      <defs>
        <filter id={f(0)} x="4.09591" y="-44.1761" width="111.037" height="98.4416" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="6.25234" />
        </filter>
        <filter id={f(1)} x="46.2974" y="-53.0009" width="217.731" height="215.86" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="30.2268" />
        </filter>
        <filter id={f(2)} x="-100.018" y="-36.7558" width="229.238" height="204.397" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="25.6957" />
        </filter>
        <filter id={f(3)} x="-100.018" y="-36.7558" width="229.238" height="204.397" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="25.6957" />
        </filter>
        <filter id={f(4)} x="-84.3985" y="-35.003" width="205.042" height="204.834" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="25.6957" />
        </filter>
        <filter id={f(5)} x="27.9915" y="71.5493" width="187.691" height="190.791" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="24.4184" />
        </filter>
        <filter id={f(6)} x="-11.8808" y="-98.7085" width="201.38" height="197.45" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="22.1301" />
        </filter>
        <filter id={f(7)} x="-44.4432" y="19.9522" width="252.513" height="260.404" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="19.7631" />
        </filter>
        <filter id={f(8)} x="81.1915" y="25.7722" width="140.46" height="134.637" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="17.6843" />
        </filter>
        <filter id={f(9)} x="55.1499" y="-47.2531" width="187.555" height="167.957" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="14.9365" />
        </filter>
        <filter id={f(10)} x="-24.2633" y="-27.1515" width="124.223" height="146.372" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="18.4865" />
        </filter>
      </defs>
    </svg>
  );
}

function lettermark(letter: string): IconType {
  function Lettermark({ className, ...props }: IconBaseProps) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" className={className} {...props}>
        <rect x="0.5" y="0.5" width="15" height="15" rx="4" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <text x="8" y="11.6" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">
          {letter}
        </text>
      </svg>
    );
  }
  return Lettermark;
}

function DevinIcon({ className, ...props }: IconBaseProps) {
  return (
    <svg viewBox="45 45 337 337" fill="currentColor" className={className} {...props}>
      <path d="M70 159.333V91.3471C70 88.3592 71.594 85.5983 74.1816 84.1044L133.043 50.1205C135.631 48.6265 138.819 48.6265 141.407 50.1205L200.269 84.1044C202.856 85.5983 204.45 88.3592 204.45 91.3471V126.068C204.708 137.606 210.806 148.734 221.531 154.926C232.256 161.117 244.942 160.834 255.063 155.289L285.132 137.929C287.719 136.435 290.907 136.435 293.495 137.929L352.357 171.913C354.944 173.406 356.538 176.167 356.538 179.155V247.123C356.538 250.111 354.944 252.872 352.357 254.366L293.495 288.35C290.907 289.844 287.719 289.844 285.132 288.35L255.306 271.13C245.146 265.456 232.344 265.117 221.534 271.358C210.809 277.55 204.711 288.678 204.453 300.215V334.926C204.453 337.914 202.859 340.675 200.271 342.169L141.41 376.153C138.822 377.647 135.634 377.647 133.046 376.153L74.1845 342.169C71.5969 340.675 70.0028 337.914 70.0028 334.926V266.959C70.0029 263.971 71.5969 261.21 74.1845 259.716L133.046 225.732C135.634 224.238 138.822 224.238 141.41 225.732L171.547 243.132C181.656 248.638 194.306 248.906 205.005 242.729C215.815 236.488 221.922 225.231 222.088 213.595C221.83 202.057 215.732 189.737 205.008 183.545C194.283 177.353 181.597 177.636 171.476 183.181L141.269 200.72C138.67 202.229 135.461 202.228 132.864 200.716L74.1576 166.562C71.5835 165.065 70 162.311 70 159.333Z" />
    </svg>
  );
}

const ICONS: Record<AgentSource, IconType> = {
  "claude-code": SiClaude,
  codex: RiOpenaiFill,
  "gemini-cli": SiGooglegemini,
  antigravity: AntigravityIcon,
  opencode: SiOpencode,
  "kimi-code": SiMoonshotai,
  "qwen-code": SiQwen,
  "copilot-cli": SiGithubcopilot,
  cline: SiCline,
  "roo-code": lettermark("R"),
  "kilo-code": lettermark("K"),
  zcode: lettermark("Z"),
  zed: SiZedindustries,
  devin: DevinIcon,
  "deepseek-harness": SiDeepseek,
  vscode: VscVscode,
};

const TINTS: Record<AgentSource, string> = {
  "claude-code": "text-claude",
  codex: "text-t2",
  "gemini-cli": "text-gemini",
  antigravity: "",
  opencode: "text-t2",
  "kimi-code": "text-t2",
  "qwen-code": "text-qwen",
  "copilot-cli": "text-t2",
  cline: "text-t2",
  "roo-code": "text-t2",
  "kilo-code": "text-t2",
  zcode: "text-t2",
  zed: "text-t2",
  devin: "text-t2",
  "deepseek-harness": "text-deepseek",
  vscode: "text-vscode",
};

export function SourceIcon({ source, className }: { source: AgentSource; className?: string }) {
  const Icon = ICONS[source];
  return <Icon className={cn("size-3.5 shrink-0", TINTS[source], className)} aria-label={AGENT_SOURCE_LABELS[source]} role="img" />;
}

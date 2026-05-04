import { cn } from "../lib/cn";

// Mechanism diagram: visualizes the 3-layer non-custodial architecture
// (Polymarket Safe → Raven session signer → Polymarket CLOB) inline on
// the onboard page. Pure SVG-in-JSX so colors track CSS variables and
// the diagram restyles automatically when tokens change.
//
// Geometry:
//   viewBox 640x540
//   - Three stacked layer boxes at x=20 width=400, y=20 / y=180 / y=400
//   - Right column (x=440..630) holds annotation callouts
//   - Connector arrows between layers carry the call/flow labels
//
// See docs/internal/plan/2026-05-04-design-elements-inventory.md §1.6.

type MechanismDiagramProps = {
  className?: string;
};

// Common stroke widths kept consistent with Lucide line icons.
const BORDER_STROKE = 1.5;
const ARROW_STROKE = 1.25;

// Layer box geometry — keep in sync with the connector arrow Y positions.
const BOX_X = 20;
const BOX_W = 400;

const SAFE_Y = 20;
const SAFE_H = 110;

const SIGNER_Y = 180;
const SIGNER_H = 160;

const CLOB_Y = 390;
const CLOB_H = 110;

// Right-column annotation x-anchor.
const ANNOT_X = 440;

export function MechanismDiagram({ className }: MechanismDiagramProps) {
  return (
    <div
      className={cn(className)}
      style={{
        width: "100%",
        maxWidth: 640,
        margin: "16px 0"
      }}
    >
      <svg
        viewBox="0 0 640 540"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="mech-title mech-desc"
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <title id="mech-title">Raven non-custodial architecture</title>
        <desc id="mech-desc">
          Three-layer flow: user&apos;s Polymarket Safe holds USDC.e; Raven&apos;s
          revocable session signer signs Polymarket orders only; Polymarket
          CLOB attributes orders to Raven&apos;s builder code and pays
          builder rewards from its own reward pool.
        </desc>

        <defs>
          {/* Solid arrowhead in muted text color for flow arrows. */}
          <marker
            id="mech-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-soft)" />
          </marker>
          {/* Smaller, lighter arrowhead used on annotation pointer lines. */}
          <marker
            id="mech-arrow-soft"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-dim)" />
          </marker>
        </defs>

        {/* ----- Layer 1: Polymarket Safe (user-controlled) ----- */}
        <g>
          <rect
            x={BOX_X}
            y={SAFE_Y}
            width={BOX_W}
            height={SAFE_H}
            rx={10}
            ry={10}
            fill="var(--pos-soft)"
            stroke="var(--pos)"
            strokeWidth={BORDER_STROKE}
          />
          <text
            x={BOX_X + 20}
            y={SAFE_Y + 32}
            fill="var(--text)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="16"
            fontWeight="600"
          >
            Your Polymarket Safe
          </text>
          <text
            x={BOX_X + 20}
            y={SAFE_Y + 56}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="13"
          >
            USDC.e you control. Raven cannot move it.
          </text>
          <text
            x={BOX_X + 20}
            y={SAFE_Y + 84}
            fill="var(--text-dim)"
            fontFamily="var(--font-jetbrains-mono), 'SF Mono', Menlo, monospace"
            fontSize="11"
          >
            ERC-4337 Safe Proxy · Polygon
          </text>
        </g>

        {/* Annotation: Withdraw anytime */}
        <g>
          <line
            x1={BOX_X + BOX_W}
            y1={SAFE_Y + SAFE_H / 2}
            x2={ANNOT_X - 6}
            y2={SAFE_Y + SAFE_H / 2}
            stroke="var(--text-dim)"
            strokeWidth={ARROW_STROKE}
            markerEnd="url(#mech-arrow-soft)"
          />
          <text
            x={ANNOT_X}
            y={SAFE_Y + SAFE_H / 2 - 6}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="12"
            fontWeight="500"
          >
            Withdraw anytime
          </text>
          <text
            x={ANNOT_X}
            y={SAFE_Y + SAFE_H / 2 + 12}
            fill="var(--text-dim)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="11"
          >
            No lockup, no permission
          </text>
        </g>

        {/* ----- Connector: Safe ↔ session signer ----- */}
        <g>
          {/* Downward arrow: signer signs operations on the Safe */}
          <line
            x1={BOX_X + BOX_W / 2}
            y1={SAFE_Y + SAFE_H + 6}
            x2={BOX_X + BOX_W / 2}
            y2={SIGNER_Y - 6}
            stroke="var(--text-soft)"
            strokeWidth={ARROW_STROKE}
            markerStart="url(#mech-arrow)"
          />
          <text
            x={BOX_X + BOX_W / 2 + 14}
            y={SAFE_Y + SAFE_H + 26}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="12"
          >
            Trade-only signature
          </text>
          <text
            x={BOX_X + BOX_W / 2 + 14}
            y={SAFE_Y + SAFE_H + 42}
            fill="var(--text-dim)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="11"
          >
            (you authorize once, revocable on-chain)
          </text>
        </g>

        {/* ----- Layer 2: Raven session signer ----- */}
        <g>
          <rect
            x={BOX_X}
            y={SIGNER_Y}
            width={BOX_W}
            height={SIGNER_H}
            rx={10}
            ry={10}
            fill="var(--accent-soft)"
            stroke="var(--accent)"
            strokeWidth={BORDER_STROKE}
          />
          <text
            x={BOX_X + 20}
            y={SIGNER_Y + 30}
            fill="var(--text)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="16"
            fontWeight="600"
          >
            Raven session signer
          </text>
          <text
            x={BOX_X + 20}
            y={SIGNER_Y + 52}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="13"
          >
            Server-side scoped key. Revocable.
          </text>

          {/* Allowed row */}
          <g transform={`translate(${BOX_X + 20}, ${SIGNER_Y + 76})`}>
            <text
              x={0}
              y={12}
              fill="var(--pos)"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontSize="14"
              fontWeight="600"
            >
              ✓
            </text>
            <text
              x={18}
              y={12}
              fill="var(--text)"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontSize="13"
            >
              Sign Polymarket orders
            </text>
          </g>

          {/* Denied row 1 */}
          <g transform={`translate(${BOX_X + 20}, ${SIGNER_Y + 102})`}>
            <text
              x={0}
              y={12}
              fill="var(--text-dim)"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontSize="14"
              fontWeight="600"
            >
              ✗
            </text>
            <text
              x={18}
              y={12}
              fill="var(--text-dim)"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontSize="13"
              textDecoration="line-through"
            >
              Withdraw or transfer USDC.e
            </text>
          </g>

          {/* Denied row 2 */}
          <g transform={`translate(${BOX_X + 20}, ${SIGNER_Y + 126})`}>
            <text
              x={0}
              y={12}
              fill="var(--text-dim)"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontSize="14"
              fontWeight="600"
            >
              ✗
            </text>
            <text
              x={18}
              y={12}
              fill="var(--text-dim)"
              fontFamily="var(--font-inter), system-ui, sans-serif"
              fontSize="13"
              textDecoration="line-through"
            >
              Approve new tokens or contracts
            </text>
          </g>
        </g>

        {/* Annotation: revoke anytime, KMS-held */}
        <g>
          <line
            x1={BOX_X + BOX_W}
            y1={SIGNER_Y + SIGNER_H / 2}
            x2={ANNOT_X - 6}
            y2={SIGNER_Y + SIGNER_H / 2}
            stroke="var(--text-dim)"
            strokeWidth={ARROW_STROKE}
            markerEnd="url(#mech-arrow-soft)"
          />
          <text
            x={ANNOT_X}
            y={SIGNER_Y + SIGNER_H / 2 - 6}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="12"
            fontWeight="500"
          >
            Revoke anytime
          </text>
          <text
            x={ANNOT_X}
            y={SIGNER_Y + SIGNER_H / 2 + 12}
            fill="var(--text-dim)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="11"
          >
            Key held in KMS (Privy)
          </text>
        </g>

        {/* ----- Connector: signer → CLOB ----- */}
        <g>
          <line
            x1={BOX_X + BOX_W / 2}
            y1={SIGNER_Y + SIGNER_H + 6}
            x2={BOX_X + BOX_W / 2}
            y2={CLOB_Y - 6}
            stroke="var(--text-soft)"
            strokeWidth={ARROW_STROKE}
            markerEnd="url(#mech-arrow)"
          />
          <text
            x={BOX_X + BOX_W / 2 + 14}
            y={SIGNER_Y + SIGNER_H + 26}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="12"
          >
            Order + builder code
          </text>
        </g>

        {/* ----- Layer 3: Polymarket CLOB ----- */}
        <g>
          <rect
            x={BOX_X}
            y={CLOB_Y}
            width={BOX_W}
            height={CLOB_H}
            rx={10}
            ry={10}
            fill="var(--panel-soft)"
            stroke="var(--border)"
            strokeWidth={BORDER_STROKE}
          />
          <text
            x={BOX_X + 20}
            y={CLOB_Y + 32}
            fill="var(--text)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="16"
            fontWeight="600"
          >
            Polymarket CLOB
          </text>
          <text
            x={BOX_X + 20}
            y={CLOB_Y + 56}
            fill="var(--text-soft)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="13"
          >
            Order matched. Builder code = Raven.
          </text>
          <text
            x={BOX_X + 20}
            y={CLOB_Y + 84}
            fill="var(--text-dim)"
            fontFamily="var(--font-jetbrains-mono), 'SF Mono', Menlo, monospace"
            fontSize="11"
          >
            @polymarket/clob-client · V2
          </text>
        </g>

        {/* Annotation: builder rewards paid by Polymarket */}
        <g>
          <line
            x1={BOX_X + BOX_W}
            y1={CLOB_Y + CLOB_H / 2}
            x2={ANNOT_X - 6}
            y2={CLOB_Y + CLOB_H / 2}
            stroke="var(--text-dim)"
            strokeWidth={ARROW_STROKE}
            markerEnd="url(#mech-arrow-soft)"
          />
          <text
            x={ANNOT_X}
            y={CLOB_Y + CLOB_H / 2 - 6}
            fill="var(--accent)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="12"
            fontWeight="600"
          >
            Builder rewards → Raven
          </text>
          <text
            x={ANNOT_X}
            y={CLOB_Y + CLOB_H / 2 + 12}
            fill="var(--text-dim)"
            fontFamily="var(--font-inter), system-ui, sans-serif"
            fontSize="11"
          >
            Paid by Polymarket, not you
          </text>
        </g>
      </svg>
    </div>
  );
}

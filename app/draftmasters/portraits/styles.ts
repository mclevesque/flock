export const STUDIO_STYLES = `
.ps-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; flex-wrap: wrap; margin-bottom: 6px;
}
.ps-title { font-size: clamp(24px, 4vw, 34px); font-weight: 800; letter-spacing: -0.02em; margin: 4px 0 0; }
.ps-help { max-width: 660px; margin-bottom: 18px; }

.ps-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
.ps-select {
  min-height: 44px; padding: 10px 14px; border-radius: 11px;
  border: 1px solid var(--dm-line-hot); background: var(--dm-panel-2);
  color: var(--dm-text); font-size: 15px; font-family: inherit;
}
.ps-count { font-size: 13px; color: var(--dm-dim); margin-left: auto; font-variant-numeric: tabular-nums; }
.ps-note-err {
  margin: 0 0 14px; padding: 10px 13px; border-radius: 10px; font-size: 13.5px;
  border: 1px solid var(--dm-g-crippling); color: var(--dm-g-crippling);
  background: rgba(208,52,44,.08);
}

/* Cards size themselves; the grid just wraps. */
.ps-grid {
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  padding-bottom: 40px;
}

.ps-card { cursor: pointer; }
.ps-shot {
  position: relative; aspect-ratio: 4 / 5; border-radius: 12px; overflow: hidden;
  border: 1px solid var(--dm-line); background: var(--dm-panel-2);
  display: grid; place-items: center;
  transition: border-color .15s ease, transform .1s ease, box-shadow .15s ease;
}
.ps-card:hover .ps-shot { border-color: var(--dm-line-hot); transform: translateY(-2px); }
/* Dashed while dragging: the card is a drop target, and it should look like one. */
.ps-card[data-over="1"] .ps-shot {
  border: 2px dashed var(--dm-gold);
  box-shadow: 0 0 26px rgba(212,169,66,.22);
}
.ps-card[data-status="saved"] .ps-shot { border-color: var(--dm-g-boon); }
.ps-card[data-status="error"] .ps-shot { border-color: var(--dm-g-crippling); }

.ps-shot img { width: 100%; height: 100%; object-fit: cover; }
.ps-initial { font-size: 40px; font-weight: 800; color: rgba(212,169,66,.35); }

.ps-badge {
  position: absolute; top: 7px; left: 7px;
  font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  padding: 3px 8px; border-radius: 999px; color: #12100a;
}
.ps-saving { background: var(--dm-gold); }
.ps-saved  { background: var(--dm-g-boon); }
.ps-error  { background: var(--dm-g-crippling); color: #fff; }
.ps-drop {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: rgba(10,10,11,.72); color: var(--dm-gold);
  font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
}

/* What the card IS, then what it COSTS. The two are allowed to disagree and
   this grid is where you would spot it if one of them were wrong. */
.ps-stats {
  display: flex; align-items: baseline; justify-content: center; gap: 7px;
  margin: 3px 0 0; font-variant-numeric: tabular-nums;
}
.ps-stats b { font-size: 14px; font-weight: 800; color: #f0e6d2; }
.ps-stats b i { font-style: normal; opacity: .4; margin: 0 1px; }
.ps-stats em { font-style: normal; font-size: 10.5px; color: #6fd0a0; }
.ps-stats s { text-decoration: none; font-size: 11px; color: rgba(240,230,210,.35); }

.ps-name {
  margin: 7px 2px 0; font-size: 12.5px; line-height: 1.3; color: var(--dm-dim);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
`;

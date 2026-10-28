# PhotoChange design system

Hallmark v2.0.0, full redesign, app scope. Baseline: d732cac1485de0be50ab3b544ccb2c95b1c326f8.

## Product and material
A local image workbench for importing, cropping, resizing, watermarking, ID photos, decoration and export. The user's image is the main visual. No stock pictures, fabricated metrics or decorative illustrations.

## System
Graphite solid surfaces, blue actions from the existing brand. Colors and font family are declared in the root block in style.css. Keep a 4px spacing scale, a 40px desktop control height and 44px touch targets. Numeric export and size fields use tabular numerals. Only state feedback moves; reduced motion suppresses transitions.

## Screens
Home preserves the existing full-page navigation, with a direct workbench button. Desktop workbench has a left tool rail, central canvas and a contextual right parameter panel. At 1000px and below the tools and active parameters stack above the canvas. Export settings remain grouped after the work area. Batch, restore and alert states use the same system.

## Kept
Every original control id, data-act, data-c, input name/type, event handler, export format and script remains. Existing image/encoding/storage logic and home wheel/touch/keyboard behavior are unchanged. Legacy hero-art background metadata remains for compatibility, rendered inert behind the solid wordmark. The decorative effect canvas and grain are visually suppressed.

## Copy changes
The hero lists the same image workflow as a sentence. Middle-dot meta separators became punctuation. The privacy line now accurately describes on-device session storage, instead of claiming everything disappears when the page closes. Existing support and install links remain.

## Verification
Run npm test and Hallmark sloplint with --scope app --render against the local server. Check desktop and phone, active tools, import, image transform, export, batch, restore and dialogs. Screenshots are review artifacts outside the repository; do not treat static lint as a browser pass.

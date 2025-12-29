# Design Guidelines: Excel Attendance Converter

## Design Approach
**System Selected:** Material Design (MUI v5)
**Rationale:** Utility-focused application requiring clarity, trust, and efficiency. Material Design provides robust patterns for form-based workflows and status feedback.

**Core Principles:**
1. **Clarity First:** Every UI element serves a clear purpose in the conversion workflow
2. **Trust Through Transparency:** Visual feedback at every step builds user confidence
3. **Efficiency:** Minimize steps from upload to download

---

## Typography

**Font Family:** 
- Primary: "Roboto", sans-serif (Material Design standard)
- Korean optimized: "Noto Sans KR", "Roboto", sans-serif (excellent Hangul readability)

**Hierarchy:**
- Page Title: 32px / font-weight 700 / letter-spacing -0.5px
- Section Headers: 20px / font-weight 600
- Body Text: 16px / font-weight 400 / line-height 1.5
- Helper Text: 14px / font-weight 400 / color text.secondary
- Button Labels: 15px / font-weight 500 / text-transform uppercase

---

## Layout System

**Spacing Units:** Tailwind equivalents mapped to MUI spacing(n)
- Common units: spacing(2), spacing(3), spacing(4), spacing(6), spacing(8)
- Tailwind reference: 2=8px, 3=12px, 4=16px, 6=24px, 8=32px

**Container Structure:**
- Max-width: 800px (md breakpoint)
- Padding: spacing(3) mobile / spacing(4) desktop
- Vertical rhythm: spacing(4) between major sections, spacing(2) between related elements

**Responsive Breakpoints:**
- Mobile: < 600px (full-width cards, stacked buttons)
- Tablet: 600-960px (comfortable padding increases)
- Desktop: > 960px (maximum 800px centered container)

---

## Component Library

### File Upload Zone
- **Visual:** Dashed border (2px), rounded corners (8px)
- **States:**
  - Default: Light gray border, cloud upload icon centered
  - Hover: Primary color border, slight background tint
  - Active/Dragging: Solid primary border, pronounced background tint
  - Success: Green border with checkmark icon
- **Size:** Min-height 180px, full-width
- **Typography:** "파일 선택 또는 드래그앤드롭" (16px, centered)

### Sheet Selection Dropdown
- **Style:** MUI OutlinedInput variant
- **Width:** Full-width with max 400px on desktop
- **Label:** Floating label "시트 선택"
- **State:** Disabled until file uploaded

### Action Buttons
- **Primary (Convert):** 
  - Size: Large (48px height)
  - Full-width on mobile, auto-width desktop (min 200px)
  - Icon: Download icon left-aligned, 24px
  - Elevation: 2 default, 4 on hover
- **Secondary (Reset):**
  - Outlined variant
  - Same sizing as primary
  - Icon: Refresh icon

**Button Group Spacing:** spacing(2) gap, centered alignment

### Status Feedback
- **Loading:** CircularProgress centered, size 40px, primary color
- **Success Alert:** 
  - Green filled background (#4caf50)
  - White text
  - Checkmark icon
  - Auto-dismiss after 3 seconds
- **Error Alert:**
  - Red filled background (#f44336)
  - White text
  - Warning icon
  - Manual dismiss

### Progress Indicators
- **File Processing:** Linear progress bar, indeterminate, positioned below upload zone
- **Conversion Status:** Stepper component (3 steps: Upload → Process → Download)

---

## Visual Design Elements

**Cards/Papers:**
- Background: White (#ffffff)
- Elevation: 3 (Material shadow)
- Border-radius: 12px
- Padding: spacing(4) mobile / spacing(6) desktop

**Borders:**
- Standard: 1px solid rgba(0, 0, 0, 0.12)
- Focus: 2px solid primary color
- Success: 2px solid success color

**Icons:**
- Library: Material Icons (via MUI)
- Size: 24px for buttons, 48px for upload zone
- Color: Inherit from context (primary/secondary/disabled)

---

## Interaction Patterns

**Workflow States:**
1. **Initial:** Upload button prominent, other controls disabled
2. **File Loaded:** Sheet selector enabled, upload zone shows filename
3. **Processing:** All inputs disabled, progress indicator visible
4. **Complete:** Download triggered automatically, success message, reset button enabled

**Micro-interactions:**
- Button ripple effect (Material standard)
- Dropdown expand/collapse animation (200ms ease)
- Alert slide-in from top (300ms ease-out)
- No page transitions or scroll-based animations

**Error Handling:**
- Invalid file type: Red alert with specific message
- Empty sheet: Warning alert with guidance
- Network error: Retry button in error alert

---

## Color Palette (MUI Theme)

While specific hex values are determined later, establish the **semantic color roles**:
- **Primary:** Professional blue (buttons, links, active states)
- **Success:** Confirmation green (success messages, completed states)
- **Warning:** Attention yellow (processing states, important notices)
- **Error:** Alert red (error messages, validation failures)
- **Text:** High contrast for Korean characters (primary/secondary/disabled variants)
- **Background:** Neutral light tones for surfaces and cards

---

## Images

**No images required.** This is a utility application where visual clarity and functional design take precedence. All iconography handled through Material Icons library.
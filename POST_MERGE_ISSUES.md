# Post-Merge Issues - Personalization Theme Support

**Date:** 2025-11-03
**Branch:** personalisation_WIP (after merging main)

---

## Critical Bug

### 1. Kanban Board - filteredTasks Reference Error ❌
**Error:** `ReferenceError: can't access lexical declaration 'filteredTasks' before initialization`

**Location:** `frontend/src/components/kanban-board.jsx`

**Cause:** The `filteredTasks` variable is being used in a `useEffect` hook (line 443-450) BEFORE it's declared (line 454-459). JavaScript hoisting issue.

**Fix Required:**
- Move the `filteredTasks` useMemo definition BEFORE the useEffect that references it
- OR remove the second useEffect that checks filteredTasks (lines 443-450)

---

## Theme Switching Issues

### 2. Sidebar Navigation - Theme Not Switching ❌
**File:** `frontend/src/components/sidebar-navigation.jsx`

**Issue:** The entire left sidebar does not respond to theme changes

**Likely Cause:**
- NavItem buttons use inline styles that override theme CSS variables
- Background colors are hardcoded instead of using theme-aware classes

**Fix Required:**
- Remove inline `style` props from NavItem buttons
- Use theme-aware Tailwind classes or CSS variables properly
- Check SettingsContext theme application

---

### 3. Project List - Stuck Hover State ❌
**File:** `frontend/src/components/sidebar-navigation.jsx` (lines ~398-402)

**Issue:** Project list items on the left sidebar get stuck in hover state after mouse leaves

**Code:**
```jsx
onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent))'}
onMouseLeave={(e) => e.target.style.backgroundColor = 'rgb(var(--muted))'}
```

**Cause:** Using inline styles with event handlers - the mouseLeave handler may not be firing correctly, or the target reference is wrong

**Fix Required:**
- Replace inline style manipulation with CSS classes
- Use hover: pseudo-class in Tailwind instead of JavaScript
- Example: `hover:bg-accent` instead of onMouseEnter/onMouseLeave

---

### 4. Project Details Page - Theme Not Switching ❌
**File:** `frontend/src/components/project-details.jsx`

**Issue:** Project details page does not switch themes correctly

**Fix Required:**
- Check for hardcoded color classes (bg-[#...], text-gray-...)
- Replace with theme-aware CSS variables or Tailwind theme classes
- Ensure parent containers inherit theme

---

### 5. Modals - Theme Not Switching ❌
**Files:**
- `frontend/src/components/ui/dialog.jsx`
- Any Dialog/Modal components

**Issue:** Modal overlays and content don't respond to theme changes

**Fix Required:**
- Update DialogContent to use theme variables
- Check overlay background colors
- Ensure modal portals inherit theme context

---

### 6. Right Sidebars - Theme Not Switching ❌
**Files:**
- `frontend/src/components/kanban/task-side-panel.jsx`
- Any slide-out panels

**Issue:** Right-side panels (task editing, etc.) don't switch themes

**Fix Required:**
- Add theme-aware background/text colors
- Check if panels are rendered outside theme context
- Apply theme classes to panel containers

---

### 7. Project Grid View - Theme Not Switching ❌
**File:** `frontend/src/components/projects-list.jsx` (likely)

**Issue:** Project grid/list view doesn't respond to theme changes

**Fix Required:**
- Update project card components to use theme variables
- Replace hardcoded colors with theme-aware classes

---

## Root Cause Analysis

**Primary Issue:** Main's components use hardcoded Tailwind colors (e.g., `bg-[#2a2a2e]`, `text-gray-400`) instead of theme-aware CSS variables.

**Personalization Branch Expected:** Components should use CSS variables defined in `frontend/src/styles/themes.css`:
- `rgb(var(--background))`
- `rgb(var(--foreground))`
- `rgb(var(--card))`
- `rgb(var(--muted))`
- etc.

---

## Fix Strategy for Next Session

### Phase 1: Critical Bug Fix (FIRST)
1. Fix filteredTasks initialization error in kanban-board.jsx
2. Test that kanban board loads without errors

### Phase 2: Systematic Theme Support
For each component with theme issues:
1. Identify hardcoded colors (search for `bg-[#`, `text-gray-`, etc.)
2. Replace with theme CSS variables
3. Test theme switching works

### Phase 3: Remove Inline Styles
1. Find all `onMouseEnter`/`onMouseLeave` inline style manipulations
2. Replace with Tailwind hover: classes
3. Test hover states work correctly

---

## Files to Review/Fix

### Priority 1 (Blocking)
- [ ] `frontend/src/components/kanban-board.jsx` - Fix filteredTasks error

### Priority 2 (Theme Core)
- [ ] `frontend/src/components/sidebar-navigation.jsx` - Fix hover states, theme support
- [ ] `frontend/src/components/ui/dialog.jsx` - Modal theme support
- [ ] `frontend/src/components/project-details.jsx` - Theme support

### Priority 3 (Components)
- [ ] `frontend/src/components/kanban/task-side-panel.jsx` - Right panel theme
- [ ] `frontend/src/components/projects-list.jsx` - Grid view theme
- [ ] Any other slide-out panels

---

## Testing Checklist

After fixes:
- [ ] Kanban board loads without console errors
- [ ] Theme toggle switches all components
- [ ] Hover states activate and deactivate correctly
- [ ] Modals/dialogs inherit theme
- [ ] Side panels inherit theme
- [ ] No inline styles overriding theme CSS

---

## Notes

The merge brought in main's improved architecture but lost theme awareness because main uses hardcoded Tailwind colors while personalisation_WIP uses CSS variable theming system.

**Solution:** Update merged components to use the existing theme system from `frontend/src/styles/themes.css` and `frontend/src/contexts/settings-context.jsx`.


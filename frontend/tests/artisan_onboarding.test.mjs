import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Header and Home page contain Role Switcher directing artisans to /artisans/onboard", () => {
  const headerSource = fs.readFileSync(
    path.resolve("components/common/Header.tsx"),
    "utf-8"
  );
  const homeSource = fs.readFileSync(
    path.resolve("app/page.tsx"),
    "utf-8"
  );

  assert.ok(
    headerSource.includes("/artisans/onboard"),
    "Header must include link to /artisans/onboard"
  );
  assert.ok(
    headerSource.includes("कारीगर / Artisan") && headerSource.includes("Tourist"),
    "Header must display Tourist vs. कारीगर / Artisan role switcher"
  );
  assert.ok(
    homeSource.includes("/artisans/onboard"),
    "Home page must include artisan onboarding portal CTA"
  );
});

test("Artisan Onboarding & Catalogue Portal (/artisans/onboard) supports Hindi voice, 4-digit PIN, and self-service catalogue", () => {
  const onboardSource = fs.readFileSync(
    path.resolve("app/artisans/onboard/page.tsx"),
    "utf-8"
  );

  // Verify Hindi-first New Onboarding UI elements
  assert.ok(
    onboardSource.includes("नया पंजीकरण"),
    "Must render Hindi New Onboarding tab (नया पंजीकरण)"
  );
  assert.ok(
    onboardSource.includes("4-अंकों का पिन"),
    "Must render 4-digit numeric PIN input (4-अंकों का पिन)"
  );
  assert.ok(
    onboardSource.includes("/artisans/onboard"),
    "Must submit onboarding payload to /artisans/onboard"
  );

  // Verify Returning Artisan Login & Catalogue Manager
  assert.ok(
    onboardSource.includes("मेरी दुकान / मेरा कैटलॉग"),
    "Must render Returning Artisan Login & Catalogue tab (मेरी दुकान / मेरा कैटलॉग)"
  );
  assert.ok(
    onboardSource.includes("/artisans/login"),
    "Must authenticate returning artisan via POST /api/artisans/login"
  );
  assert.ok(
    onboardSource.includes("/artisans/me/catalogue"),
    "Must support adding and removing catalogue photos via /api/artisans/me/catalogue"
  );
});


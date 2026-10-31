import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Role-Based Login (/login), Tourist Homepage (/), Connected Flows & Admin Superusers", () => {
  test("Simple /login page supports role selection (Tourist, Artisan, Admin) and email/password auth", () => {
    const loginSource = fs.readFileSync(
      path.resolve("app/login/page.tsx"),
      "utf-8"
    );
    assert.ok(loginSource.includes("Tourist"), "Login page must include Tourist role option");
    assert.ok(loginSource.includes("Artisan"), "Login page must include Artisan role option");
    assert.ok(loginSource.includes("Admin"), "Login page must include Admin role option");
    assert.ok(loginSource.includes("/artisans/onboard"), "Artisan role option must branch to /artisans/onboard");
    assert.ok(loginSource.includes("admin@trailweave.org"), "Admin login must support pre-seeded superuser");
  });

  test("Root Homepage (/) serves as Tourist Homepage with Cultured Local Friend AI Concierge & District Hub", () => {
    const homeSource = fs.readFileSync(
      path.resolve("app/page.tsx"),
      "utf-8"
    );
    const basketSource = fs.readFileSync(
      path.resolve("components/basket/BasketDrawer.tsx"),
      "utf-8"
    );
    const scratchSource = fs.readFileSync(
      path.resolve("components/common/PlanFromScratchModal.tsx"),
      "utf-8"
    );

    assert.ok(
      homeSource.includes('href="/trails"'),
      "Tourist Homepage must link to dedicated /trails endpoint"
    );
    assert.ok(
      homeSource.includes('href="/artisans"'),
      "Tourist Homepage must link to dedicated /artisans directory"
    );
    assert.ok(
      homeSource.includes('href="/trip"'),
      "Tourist Homepage must link to dedicated /trip endpoint"
    );
    assert.ok(
      homeSource.includes("Cultured Local Friend") || homeSource.includes("AI Concierge"),
      "Tourist Homepage must feature Cultured Local Friend AI Concierge & District Hub"
    );
    assert.ok(
      basketSource.includes("createTripFromBuilder"),
      "BasketDrawer must generate itinerary via createTripFromBuilder"
    );
    assert.ok(
      scratchSource.includes("createTripFromBuilder"),
      "PlanFromScratchModal must generate itinerary via createTripFromBuilder"
    );
  });

  test("Admin Portal (/admin) includes Admin Team & Superusers tab to add new administrators", () => {
    const adminSource = fs.readFileSync(
      path.resolve("app/admin/page.tsx"),
      "utf-8"
    );
    assert.ok(
      adminSource.includes("Admin Team &amp; Superusers") ||
        adminSource.includes("Admin Team"),
      "Admin Portal must include Admin Team & Superusers tab"
    );
    assert.ok(
      adminSource.includes("addAdminMember"),
      "Admin Portal must allow existing admins to add new administrators"
    );
  });
});

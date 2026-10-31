import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Admin Curation & Verification Portal (/admin) fulfills Ticket 12 requirements", async (t) => {
  const adminPagePath = path.resolve(__dirname, "../app/admin/page.tsx");
  assert.ok(fs.existsSync(adminPagePath), "frontend/app/admin/page.tsx must exist");
  const code = fs.readFileSync(adminPagePath, "utf-8");

  await t.test("Organized into 3 operational tabs: Voice Onboarding Drafts, All Artisans & Contact Info, Trails & Places Curation", () => {
    assert.match(
      code,
      /Voice Onboarding Drafts/,
      "Must have Voice Onboarding Drafts tab"
    );
    assert.match(
      code,
      /All Artisans &amp; Contact Info|All Artisans & Contact Info/,
      "Must have All Artisans & Contact Info tab"
    );
    assert.match(
      code,
      /Trails &amp; Places Curation|Trails & Places Curation/,
      "Must have Trails & Places Curation tab"
    );
  });

  await t.test("Voice Onboarding Drafts queue displays English Admin Brief, Missing Info Checklist, Hindi Transcript, and 1-tap tel: call button", () => {
    // English Admin Brief
    assert.match(
      code,
      /English Admin Brief/,
      "Must display English Admin Brief"
    );
    // Missing info checklist
    assert.match(
      code,
      /missing_info_checklist/,
      "Must reference extracted missing_info_checklist"
    );
    // Raw Hindi transcript
    assert.match(
      code,
      /raw_transcript/,
      "Must display raw Hindi transcript"
    );
    // 1-Tap phone call button
    assert.match(
      code,
      /href=\{`tel:\$\{draft\.sender_phone\}`\}/,
      "Must provide 1-tap direct dial tel: link for artisan's phone number"
    );
    // Read-only catalogue images preview
    assert.match(
      code,
      /catalogue_images/,
      "Must display read-only preview of artisan's catalogue photos"
    );
  });

  await t.test("Includes interactive studio verification form and 1-tap Approve & Publish and Reject controls", () => {
    // Studio details form inputs
    assert.match(code, /artisan_name/, "Must allow refining artisan name");
    assert.match(code, /craft_type/, "Must allow refining craft type");
    assert.match(code, /place_name/, "Must allow refining place/studio name");
    assert.match(code, /address/, "Must allow refining address");
    assert.match(code, /opening_time/, "Must allow refining opening hours");
    assert.match(code, /closing_time/, "Must allow refining closing hours");
    assert.match(code, /has_workshop/, "Must allow toggling workshop status");
    assert.match(code, /workshop_fee_inr/, "Must allow editing workshop fee");
    assert.match(code, /workshop_duration_minutes/, "Must allow editing workshop duration");

    // 1-Tap Approve and Reject
    assert.match(code, /1-Tap Approve &amp; Publish|1-Tap Approve & Publish/, "Must have 1-Tap Approve & Publish button");
    assert.match(code, /handleRejectDraft/, "Must have Reject draft action");
    assert.match(code, /\/api\/admin\/artisan-drafts\/\$\{draft\.id\}\/approve/, "Must call approve endpoint");
  });

  await t.test("All Artisans Directory displays complete contact details and supports profile editing", () => {
    assert.match(
      code,
      /href=\{`tel:\$\{artisan\.phone_number\}`\}/,
      "Must provide 1-tap tel: link for every verified artisan in the directory"
    );
    assert.match(
      code,
      /handleSaveArtisanEdit|\/api\/admin\/artisans\/\$\{artisanId\}/,
      "Must support editing artisan profile and calling PATCH /api/admin/artisans/{id}"
    );
  });

  await t.test("Community Trails & Places Curation supports featuring trails and importing verified places", () => {
    assert.match(
      code,
      /handleToggleTrailFeature|\/api\/admin\/trails\/\$\{trailId\}\/feature/,
      "Must allow toggling featured status on community trails"
    );
    assert.match(
      code,
      /handleCreatePlace|\/api\/admin\/places/,
      "Must allow adding and verifying Udaipur places into canonical places"
    );
  });
});


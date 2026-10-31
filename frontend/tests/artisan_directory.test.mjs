import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Artisan Studio Directory page (/artisans) fulfills Ticket 11 requirements", () => {
  const directorySource = fs.readFileSync(
    path.resolve("app/artisans/page.tsx"),
    "utf-8"
  );

  // 1. Mobile-optimized directory page listing verified craftsmen
  assert.ok(
    directorySource.includes("Udaipur Artisans") &&
      directorySource.includes("Living Heritage & Masterclasses"),
    "Directory must render Header with Living Heritage & Masterclasses"
  );
  assert.ok(
    directorySource.includes("ArtisanCard"),
    "Directory must render ArtisanCard components"
  );

  // 2. Craft category filter chips
  assert.ok(
    directorySource.includes("All Crafts") &&
      directorySource.includes("Pichwai & Miniature Painting") &&
      directorySource.includes("Pottery") &&
      directorySource.includes("Puppetry") &&
      directorySource.includes("Leather & Textiles"),
    "Directory must provide all specified craft filter chips"
  );

  // 3. Hands-on workshop filter toggle
  assert.ok(
    directorySource.includes("Hands-on Only") &&
      directorySource.includes("workshopOnly"),
    "Directory must provide hands-on masterclass filter toggle"
  );

  // 4. Clean tourist directory (artisan onboarding moved exclusively to Role Gateway /login)
  assert.equal(
    directorySource.includes("/artisans/onboard"),
    false,
    "Tourist directory must not show artisan onboarding CTA banner"
  );

  // 5. FloatingBasketButton and BasketDrawer
  assert.ok(
    directorySource.includes("FloatingBasketButton") &&
      directorySource.includes("BasketDrawer"),
    "Directory must include floating basket button and drawer"
  );
});

test("Artisan Studio Card (ArtisanCard) includes photo preview, hours, fees, and 1-tap basket addition", () => {
  const cardSource = fs.readFileSync(
    path.resolve("components/artisans/ArtisanCard.tsx"),
    "utf-8"
  );

  // Displays craft type, artisan name, address, hours, fees
  assert.ok(
    cardSource.includes("artisan.craft_type") &&
      cardSource.includes("artisan.artisan_name") &&
      cardSource.includes("artisan.address"),
    "Card must render craft type, master name, and physical address"
  );

  // Opening hours
  assert.ok(
    cardSource.includes("artisan.opening_time") &&
      cardSource.includes("artisan.closing_time"),
    "Card must display store opening and closing hours"
  );

  // Workshop fees & duration
  assert.ok(
    cardSource.includes("artisan.workshop_fee_inr") &&
      cardSource.includes("artisan.workshop_duration_minutes"),
    "Card must display workshop fees in INR and duration in minutes"
  );

  // Catalogue photo preview
  assert.ok(
    cardSource.includes("catalogue_images") || cardSource.includes("previewImage"),
    "Card must render preview photo of artisan artifacts"
  );

  // Direct 1-tap Add to Basket button
  assert.ok(
    cardSource.includes("addItem") &&
      (cardSource.includes("Add to Basket") || cardSource.includes("Added to Itinerary")),
    "Card must provide 1-tap Add to Basket button wired to BasketContext"
  );
});

test("Artisan Studio Profile view (/artisans/[id]) includes rich bio, catalogue gallery, hours, and basket CTA", () => {
  const detailSource = fs.readFileSync(
    path.resolve("app/artisans/[id]/page.tsx"),
    "utf-8"
  );

  // Master heritage bio
  assert.ok(
    detailSource.includes("artisan.bio") &&
      (detailSource.includes("Heritage Bio & Tradition") ||
        detailSource.includes("Heritage & Master Craftsmanship")),
    "Profile view must render master heritage bio"
  );

  // Catalogue & Artifact Photo Gallery
  assert.ok(
    detailSource.includes("catalogue_images") &&
      (detailSource.includes("Artifact & Craft Gallery") ||
        detailSource.includes("Catalogue Gallery")),
    "Profile view must display artisan's uploaded catalogue gallery"
  );

  // Operating retail hours
  assert.ok(
    (detailSource.includes("Daily Studio Hours") || detailSource.includes("Studio Hours")) &&
      detailSource.includes("artisan.opening_time") &&
      detailSource.includes("artisan.closing_time"),
    "Profile view must display daily studio retail hours"
  );

  // Hands-on workshop masterclass details
  assert.ok(
    detailSource.includes("Masterclass") &&
      detailSource.includes("artisan.workshop_fee_inr") &&
      detailSource.includes("artisan.workshop_duration_minutes") &&
      detailSource.includes("artisan.workshop_description"),
    "Profile view must display workshop fee, duration, and what you will learn"
  );

  // Direct 1-tap Add to Basket CTA
  assert.ok(
    detailSource.includes("addItem") &&
      (detailSource.includes("Add Workshop to Basket") ||
        detailSource.includes("Add Studio / Workshop to Itinerary")),
    "Profile view must provide direct 1-tap Add Workshop to Basket CTA"
  );
});

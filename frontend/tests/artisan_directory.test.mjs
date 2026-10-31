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

  // 4. Artisan voice onboarding CTA
  assert.ok(
    directorySource.includes("/artisans/onboard"),
    "Directory must link artisans to /artisans/onboard"
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
    "Card must display craft type, name, and address"
  );
  assert.ok(
    cardSource.includes("opening_time") && cardSource.includes("closing_time"),
    "Card must display store opening hours"
  );
  assert.ok(
    cardSource.includes("workshop_fee_inr") && cardSource.includes("workshop_duration_minutes"),
    "Card must display workshop fee and duration"
  );

  // Photo gallery preview
  assert.ok(
    cardSource.includes("catalogue_images") && cardSource.includes("primaryImage"),
    "Card must show artifact photo preview"
  );

  // Direct 1-tap Add to Basket button
  assert.ok(
    cardSource.includes("useBasket") &&
      cardSource.includes("isInBasket") &&
      cardSource.includes("handleBasketToggle"),
    "Card must wire direct 1-tap Add to Basket button to BasketContext"
  );
  assert.ok(
    cardSource.includes("Add to Itinerary") && cardSource.includes("In Basket"),
    "Card button must show Add to Itinerary and In Basket states"
  );
});

test("Artisan Studio Profile view (/artisans/[id]) includes rich bio, catalogue gallery, hours, and basket CTA", () => {
  const detailSource = fs.readFileSync(
    path.resolve("app/artisans/[id]/page.tsx"),
    "utf-8"
  );

  // Photo gallery and lightbox
  assert.ok(
    detailSource.includes("selectedPhotoIndex") &&
      detailSource.includes("isLightboxOpen") &&
      detailSource.includes("catalogue_images"),
    "Detail view must provide interactive catalogue gallery and lightbox modal"
  );

  // Heritage bio and living legacy
  assert.ok(
    detailSource.includes("Heritage & Master Craftsmanship") &&
      detailSource.includes("artisan.bio"),
    "Detail view must showcase master heritage bio"
  );

  // Operating hours & masterclass details
  assert.ok(
    detailSource.includes("Studio Hours") &&
      detailSource.includes("Hands-On Masterclass Offering") &&
      detailSource.includes("workshop_fee_inr"),
    "Detail view must display studio hours and workshop masterclass offerings"
  );

  // Direct 1-tap Add to Basket button wired to BasketContext
  assert.ok(
    detailSource.includes("useBasket") &&
      detailSource.includes("handleBasketToggle") &&
      detailSource.includes("data-testid=\"artisan-detail-basket-btn\""),
    "Detail view must provide direct 1-tap Add to Basket button wired to BasketContext"
  );

  // Call Studio and Get Directions
  assert.ok(
    detailSource.includes("tel:") && detailSource.includes("maps/search"),
    "Detail view must provide Call Studio and Get Directions links"
  );
});


export interface MockPlace {
  id: string;
  name: string;
  category: "attraction" | "heritage" | "dining" | "artisan_studio";
  latitude: number;
  longitude: number;
  address: string;
  entry_fee_inr: number;
  typical_duration_minutes: number;
}

export interface MockTrailStop {
  id: string;
  place_id: string;
  place_name: string;
  day_number: number;
  sequence_in_day: number;
  suggested_duration_minutes: number;
  estimated_transit_minutes: number;
  time_slot: string;
  traveler_tip: string;
  category?: "attraction" | "heritage" | "dining" | "artisan_studio" | string;
  entry_fee_inr?: number;
}

export interface MockTrail {
  id: string;
  title: string;
  author_name: string;
  description: string;
  duration_type: "single_day" | "multi_day";
  total_duration_hours: number;
  total_days?: number;
  estimated_cost_inr: number;
  tags: string[];
  is_experienced: boolean;
  is_featured: boolean;
  stops_count: number;
  stops?: MockTrailStop[];
}

export interface MockArtisan {
  id: string;
  artisan_name: string;
  craft_type: string;
  place_id: string;
  address: string;
  bio?: string;
  has_workshop: boolean;
  workshop_fee_inr: number;
  workshop_duration_minutes: number;
  workshop_description: string;
}

export const MOCK_PLACES: MockPlace[] = [
  {
    id: "place_city_palace",
    name: "City Palace Udaipur",
    category: "heritage",
    latitude: 24.5764,
    longitude: 73.6835,
    address: "Old City, Udaipur, Rajasthan 313001",
    entry_fee_inr: 330,
    typical_duration_minutes: 120,
  },
  {
    id: "place_mohanlal_studio",
    name: "Master Mohanlal Miniature Art Studio",
    category: "artisan_studio",
    latitude: 24.5796,
    longitude: 73.6844,
    address: "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
    entry_fee_inr: 0,
    typical_duration_minutes: 45,
  },
  {
    id: "place_pottery_studio",
    name: "Kavita Terracotta Pottery & Clay Studio",
    category: "artisan_studio",
    latitude: 24.5815,
    longitude: 73.6820,
    address: "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
    entry_fee_inr: 0,
    typical_duration_minutes: 45,
  },
  {
    id: "place_puppetry_workshop",
    name: "Udaipur Traditional Kathputli Puppetry Workshop",
    category: "artisan_studio",
    latitude: 24.5788,
    longitude: 73.6815,
    address: "Gangaur Ghat Road, Old City, Udaipur, Rajasthan 313001",
    entry_fee_inr: 0,
    typical_duration_minutes: 45,
  },
  {
    id: "place_leather_craft",
    name: "Mewar Royal Leather & Jutti Craft Studio",
    category: "artisan_studio",
    latitude: 24.5840,
    longitude: 73.6865,
    address: "Hathi Pole Bazaar, Udaipur, Rajasthan 313001",
    entry_fee_inr: 0,
    typical_duration_minutes: 25,
  },
  {
    id: "place_jagdish_temple",
    name: "Jagdish Temple",
    category: "heritage",
    latitude: 24.5794,
    longitude: 73.6841,
    address: "1 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
    entry_fee_inr: 0,
    typical_duration_minutes: 30,
  },
  {
    id: "place_bagore_haveli",
    name: "Bagore Ki Haveli",
    category: "heritage",
    latitude: 24.5798,
    longitude: 73.68,
    address: "Gangaur Ghat Marg, Old City, Udaipur, Rajasthan 313001",
    entry_fee_inr: 100,
    typical_duration_minutes: 90,
  },
  {
    id: "place_saheliyon_bari",
    name: "Saheliyon Ki Bari",
    category: "attraction",
    latitude: 24.6019,
    longitude: 73.6853,
    address: "Saheli Marg, New Vidhya Nagar, Udaipur, Rajasthan 313001",
    entry_fee_inr: 50,
    typical_duration_minutes: 60,
  },
  {
    id: "place_sukhadia_circle",
    name: "Sukhadia Circle Street Food",
    category: "dining",
    latitude: 24.6035,
    longitude: 73.6885,
    address: "Sukhadia Circle, Panchwati, Udaipur, Rajasthan 313001",
    entry_fee_inr: 0,
    typical_duration_minutes: 45,
  },
];

export const MOCK_TRAILS: MockTrail[] = [
  {
    id: "trail_royal_palaces_crafts",
    title: "Udaipur Royal Palaces & Crafts",
    author_name: "Arjun Sharma",
    description:
      "A classic single-day journey through Udaipur's iconic royal complex, sacred temples, and living heritage masterclasses.",
    duration_type: "single_day",
    total_duration_hours: 6.5,
    estimated_cost_inr: 1250,
    tags: ["heritage", "artisan", "walking"],
    is_experienced: true,
    is_featured: true,
    stops_count: 4,
    stops: [
      {
        id: "cts_rpc_1",
        place_id: "place_city_palace",
        place_name: "City Palace Udaipur",
        day_number: 1,
        sequence_in_day: 1,
        suggested_duration_minutes: 120,
        estimated_transit_minutes: 10,
        time_slot: "morning",
        traveler_tip:
          "Arrive early at 9:30 AM to beat tour groups. Purchase the museum + palace composite ticket at Badi Pol.",
      },
      {
        id: "cts_rpc_2",
        place_id: "place_mohanlal_studio",
        place_name: "Master Mohanlal Miniature Art Studio",
        day_number: 1,
        sequence_in_day: 2,
        suggested_duration_minutes: 45,
        estimated_transit_minutes: 5,
        time_slot: "morning",
        traveler_tip:
          "Located just 2 mins walk from Jagdish Chowk. Master Mohanlal demonstrates squirrel-hair fine detailing.",
      },
      {
        id: "cts_rpc_3",
        place_id: "place_jagdish_temple",
        place_name: "Jagdish Temple",
        day_number: 1,
        sequence_in_day: 3,
        suggested_duration_minutes: 30,
        estimated_transit_minutes: 10,
        time_slot: "afternoon",
        traveler_tip:
          "Climb the steep stone steps to admire the intricate 1651 AD pillar carvings.",
      },
      {
        id: "cts_rpc_4",
        place_id: "place_bagore_haveli",
        place_name: "Bagore Ki Haveli",
        day_number: 1,
        sequence_in_day: 4,
        suggested_duration_minutes: 90,
        estimated_transit_minutes: 0,
        time_slot: "sunset_evening",
        traveler_tip:
          "Book seats for the 7 PM Dharohar cultural dance performance in the neem courtyard.",
      },
    ],
  },
  {
    id: "trail_old_city_heritage_walk",
    title: "Old City Evening Heritage Walk",
    author_name: "Priya Sen",
    description:
      "Sunset views by Lake Pichola, evening prayers at Jagdish Temple, and street food tastings at Sukhadia Circle.",
    duration_type: "single_day",
    total_duration_hours: 3.5,
    estimated_cost_inr: 450,
    tags: ["heritage", "evening", "food"],
    is_experienced: true,
    is_featured: true,
    stops_count: 3,
    stops: [
      {
        id: "cts_ehw_1",
        place_id: "place_bagore_haveli",
        place_name: "Bagore Ki Haveli",
        day_number: 1,
        sequence_in_day: 1,
        suggested_duration_minutes: 75,
        estimated_transit_minutes: 5,
        time_slot: "sunset_evening",
        traveler_tip:
          "Sit by Gangaur Ghat just outside before entry to watch the sun set over Lake Pichola.",
      },
      {
        id: "cts_ehw_2",
        place_id: "place_jagdish_temple",
        place_name: "Jagdish Temple",
        day_number: 1,
        sequence_in_day: 2,
        suggested_duration_minutes: 30,
        estimated_transit_minutes: 15,
        time_slot: "evening",
        traveler_tip: "Evening aarti with temple bells is magical around 7:30 PM.",
      },
      {
        id: "cts_ehw_3",
        place_id: "place_sukhadia_circle",
        place_name: "Sukhadia Circle Street Food",
        day_number: 1,
        sequence_in_day: 3,
        suggested_duration_minutes: 60,
        estimated_transit_minutes: 0,
        time_slot: "night",
        traveler_tip:
          "Take a 10-minute auto-rickshaw to Sukhadia Circle for pav bhaji, falooda, and kulfi.",
      },
    ],
  },
];

export const MOCK_ARTISANS: MockArtisan[] = [
  {
    id: "artisan_mohanlal",
    artisan_name: "Master Mohanlal Sharma",
    craft_type: "Pichwai & Miniature Painting",
    place_id: "place_mohanlal_studio",
    address: "14 Jagdish Chowk, Old City, Udaipur, Rajasthan 313001",
    bio: "4th generation Udaipur miniature artist specializing in natural stone pigments and squirrel-hair brushes.",
    has_workshop: true,
    workshop_fee_inr: 300,
    workshop_duration_minutes: 45,
    workshop_description:
      "Learn 400-year-old squirrel-hair brush techniques on handmade paper.",
  },
  {
    id: "artisan_pottery",
    artisan_name: "Master Kavita Kumhar",
    craft_type: "Terracotta Pottery & Clay Sculpting",
    place_id: "place_pottery_studio",
    address: "22 Chandpole Ghat Road, Old City, Udaipur, Rajasthan 313001",
    bio: "Renowned Mewar potter crafting heritage earthenware and terracotta votive plaques.",
    has_workshop: true,
    workshop_fee_inr: 250,
    workshop_duration_minutes: 45,
    workshop_description:
      "Wheel throwing and traditional Mewar terracotta clay sculpting masterclass.",
  },
  {
    id: "artisan_puppetry",
    artisan_name: "Babu Bhatt Puppeteer",
    craft_type: "Kathputli Traditional String Puppetry",
    place_id: "place_puppetry_workshop",
    address: "Gangaur Ghat Road, Old City, Udaipur, Rajasthan 313001",
    bio: "Master puppeteer preserving 1,000-year-old Rajasthani wooden string puppet theater traditions.",
    has_workshop: true,
    workshop_fee_inr: 200,
    workshop_duration_minutes: 45,
    workshop_description:
      "Learn string manipulation, carving, and live traditional Rajasthani puppet theater storytelling.",
  },
  {
    id: "artisan_leather",
    artisan_name: "Ramesh Chandra Parmar",
    craft_type: "Handcrafted Camel Leather & Mojari Juttis",
    place_id: "place_leather_craft",
    address: "Hathi Pole Bazaar, Udaipur, Rajasthan 313001",
    bio: "Heritage cobbler crafting durable vegetable-tanned camel leather juttis with silk embroidery.",
    has_workshop: false,
    workshop_fee_inr: 0,
    workshop_duration_minutes: 20,
    workshop_description:
      "Browse master leather embroidery and hand-stitching techniques.",
  },
];


// Mock data for Al Karma Developments App

export const users = {
  owner: {
    id: "USR-001",
    email: "ahmed.hassan@email.com",
    password: "Owner@2025",
    name: "Ahmed Hassan Mohamed",
    phone: "+20 100 123 4567",
    nationalId: "29501011234567",
    dateOfBirth: "1995-01-01",
    unit: "Villa A-125", // Default/Current unit
    compound: "Karma Gates", // Default/Current compound
    unitStatus: "Delivered", // Delivered or Under Construction
    accountType: "Owner", // Owner, Tenant, Family, Authorized, Contractor
    role: "Owner",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    // Owner specific fields - Now has 2 units
    units: [
      {
        id: "UNIT-001",
        number: "Villa A-125",
        compound: "Karma Gates",
        type: "Villa",
        status: "Delivered",
        area: "350 sqm",
        isRented: false,
        bedrooms: 5,
        bathrooms: 4,
        hasSmartHome: true,
        hasCameras: true
      },
      {
        id: "UNIT-002",
        number: "Apartment B-203",
        compound: "Karma",
        type: "Apartment",
        status: "Delivered",
        area: "180 sqm",
        isRented: true,
        tenantName: "Sara Mahmoud Ali",
        tenantId: "USR-002",
        leaseEnd: "2025-12-31",
        bedrooms: 3,
        bathrooms: 2,
        hasSmartHome: false,
        hasCameras: false
      }
    ],
    familyMembers: ["USR-004", "USR-005"], // References to family member IDs
    authorizedUsers: ["USR-006"],
    contractors: ["USR-007"],
    hasSmartHome: true,
    hasCameras: true,
    hasBiometric: true
  },
  tenant: {
    id: "USR-002",
    email: "sara.mahmoud@email.com",
    password: "Tenant@2025",
    name: "Sara Mahmoud Ali",
    phone: "+20 101 987 6543",
    nationalId: "29403021234568",
    dateOfBirth: "1994-03-02",
    unit: "Apartment B-203",
    compound: "Karma",
    unitStatus: "Delivered",
    accountType: "Tenant",
    role: "Tenant",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    // Tenant specific fields
    landlord: "Ahmed Hassan Mohamed",
    landlordId: "USR-001",
    leaseStart: "2025-01-01",
    leaseEnd: "2025-12-31",
    leaseDaysRemaining: 292, // Auto-calculated
    units: [
      {
        id: "UNIT-002",
        number: "Apartment B-203",
        compound: "Karma",
        type: "Apartment",
        status: "Delivered",
        area: "180 sqm",
        isRented: true
      }
    ],
    permissions: {
      qrCodes: true,
      services: ["maintenance", "cleaning", "gym", "pool"],
      complaints: true,
      payments: true
    },
    hasBiometric: true,
    hasSmartHome: false,
    hasCameras: false
  },
  preOwner: {
    id: "USR-003",
    email: "khaled.ali@email.com",
    password: "PreOwner@2025",
    name: "Khaled Ali Ahmed",
    phone: "+20 122 555 7788",
    nationalId: "29512345678902",
    dateOfBirth: "1995-05-15",
    unit: "Apartment C-305",
    compound: "Kai",
    unitStatus: "Not Delivered",
    accountType: "Not Delivered Owner",
    role: "Not Delivered Owner",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
    // Not Delivered Owner specific fields
    expectedDelivery: "Q4 2025",
    paymentProgress: 60, // percentage
    constructionProgress: 75, // percentage
    units: [
      {
        id: "UNIT-003",
        number: "Apartment C-305",
        compound: "Kai",
        type: "Apartment",
        status: "Not Delivered",
        area: "180 sqm",
        isRented: false,
        hasSmartHome: false,
        hasCameras: false
      }
    ],
    hasBiometric: false,
    hasSmartHome: false,
    hasCameras: false
  },
  familyMember: {
    id: "USR-004",
    email: "omar.hassan@email.com",
    password: "Family@2025",
    name: "Omar Ahmed Hassan",
    phone: "+20 100 111 2222",
    nationalId: "30501011234569",
    dateOfBirth: "2005-06-10",
    unit: "Villa A-125",
    compound: "Karma Gates",
    unitStatus: "Delivered",
    accountType: "Family",
    role: "Family Member",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
    // Family member specific
    parentAccount: "USR-001", // Owner's ID
    relationship: "Son",
    units: [
      {
        id: "UNIT-001",
        number: "Villa A-125",
        compound: "Karma Gates",
        type: "Villa",
        status: "Delivered",
        area: "350 sqm",
        isRented: false
      }
    ],
    permissions: {
      qrCodes: true,
      services: ["gym", "pool", "clubhouse"],
      complaints: false,
      payments: false,
      smartHome: false,
      cameras: false
    },
    hasBiometric: true,
    hasSmartHome: false,
    hasCameras: false
  },
  authorizedUser: {
    id: "USR-006",
    email: "youssef.hassan@email.com",
    password: "Auth@2025",
    name: "Youssef Hassan Ibrahim",
    phone: "+20 100 777 8888",
    nationalId: "29201011234570",
    dateOfBirth: "1992-08-20",
    unit: "Villa A-125",
    compound: "Karma Gates",
    unitStatus: "Delivered",
    accountType: "Authorized",
    role: "Authorized User",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    // Authorized user specific
    parentAccount: "USR-001",
    relationship: "Brother",
    powerOfAttorney: true,
    attorneyDocument: "POA-2024-125.pdf",
    validUntil: "2026-12-31",
    units: [
      {
        id: "UNIT-001",
        number: "Villa A-125",
        compound: "Karma Gates",
        type: "Villa",
        status: "Delivered",
        area: "350 sqm",
        isRented: false
      }
    ],
    permissions: {
      // Has all owner permissions except account deletion
      fullAccess: true
    },
    hasBiometric: true,
    hasSmartHome: true,
    hasCameras: true
  },
  contractor: {
    id: "USR-007",
    email: "mahmoud.builder@email.com",
    password: "Contractor@2025",
    name: "Mahmoud Kamal",
    phone: "+20 122 333 4444",
    nationalId: "28801011234571",
    dateOfBirth: "1988-12-05",
    unit: "Villa A-125",
    compound: "Karma Gates",
    unitStatus: "Delivered",
    accountType: "Contractor",
    role: "Contractor",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop",
    // Contractor specific
    parentAccount: "USR-001",
    companyName: "Mahmoud Kamal Construction",
    service: "General Contracting",
    license: "LIC-123456",
    validUntil: "2025-12-31",
    approvalStatus: "Approved",
    workers: ["WKR-001", "WKR-002"],
    units: [
      {
        id: "UNIT-001",
        number: "Villa A-125",
        compound: "Karma Gates",
        type: "Villa",
        status: "Delivered",
        area: "350 sqm",
        isRented: false
      }
    ],
    permissions: {
      workerPermits: true,
      materialDelivery: true,
      receiveViolations: true,
      services: false,
      payments: false
    },
    hasBiometric: false,
    hasSmartHome: false,
    hasCameras: false
  }
};

export const banners = [
  {
    id: 1,
    title: "New Year Special Offers",
    description: "Enjoy exclusive discounts on all maintenance services",
    image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&h=300&fit=crop",
    link: "/offers"
  },
  {
    id: 2,
    title: "Pool Opening Soon",
    description: "Our renovated pool will be ready by March 2025",
    image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&h=300&fit=crop",
    link: "/amenities"
  },
  {
    id: 3,
    title: "Security Upgrade Complete",
    description: "New facial recognition system now active",
    image: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&h=300&fit=crop",
    link: "/security"
  }
];

export const services = {
  delivered: [
    {
      id: "housekeeping",
      icon: "🧹",
      name: "House Keeping",
      description: "Professional cleaning and housekeeping",
      category: "Services"
    },
    {
      id: "carcare",
      icon: "🚗",
      name: "Car Care",
      description: "Car washing and detailing services",
      category: "Services"
    },
    {
      id: "electrician",
      icon: "⚡",
      name: "Electrician",
      description: "Electrical repairs and installations",
      category: "Services"
    },
    {
      id: "carpenter",
      icon: "🪚",
      name: "Carpenter",
      description: "Carpentry and woodwork services",
      category: "Services"
    },
    {
      id: "it",
      icon: "💻",
      name: "IT",
      description: "IT support and tech services",
      category: "Services"
    },
    {
      id: "pest",
      icon: "🦟",
      name: "Pest Control",
      description: "Professional pest control services",
      category: "Services"
    },
    {
      id: "plumber",
      icon: "🔧",
      name: "Plumber",
      description: "Plumbing repairs and maintenance",
      category: "Services"
    }
  ],
  underConstruction: [
    {
      id: "visit",
      icon: "📅",
      name: "Schedule Visit",
      description: "Book a visit to your unit",
      category: "Construction"
    },
    {
      id: "progress",
      icon: "📊",
      name: "Construction Progress",
      description: "Track your unit's construction",
      category: "Construction"
    },
    {
      id: "payment",
      icon: "💳",
      name: "Payment Reminders",
      description: "View payment schedule",
      category: "Financial"
    },
    {
      id: "contract",
      icon: "📝",
      name: "Modify Contract",
      description: "Request contract modifications",
      category: "Legal"
    }
  ]
};

export const notifications = [
  {
    id: 1,
    title: "Payment Due Reminder",
    message: "Your monthly maintenance fee of EGP 1,200 is due on March 15, 2025",
    timestamp: "2 hours ago",
    read: false,
    type: "payment"
  },
  {
    id: 2,
    title: "Maintenance Request Approved",
    message: "Your AC repair request #MR2025-0134 has been approved and scheduled for tomorrow",
    timestamp: "5 hours ago",
    read: false,
    type: "service"
  },
  {
    id: 3,
    title: "Security Alert",
    message: "New security measures have been implemented. Please update your authorized persons list",
    timestamp: "1 day ago",
    read: true,
    type: "security"
  },
  {
    id: 4,
    title: "Community Event",
    message: "Join us for the Spring Festival on March 20th at the clubhouse",
    timestamp: "2 days ago",
    read: true,
    type: "event"
  }
];

export const complaints = [
  {
    id: "CMP-2025-0012",
    type: "Noise",
    subject: "إزعاج صوتي من الجيران",
    description: "ضوضاء عالية بعد منتصف الليل من الشقة المجاورة",
    status: "Reviewing",
    date: "2025-03-10",
    photos: [],
    userType: "Owner" // For delivered units
  },
  {
    id: "CMP-2025-0008",
    type: "Facility",
    subject: "مشكلة في الإضاءة بالممر",
    description: "إضاءة الممر في الطابق الثاني لا تعمل منذ أسبوع",
    status: "Resolved",
    date: "2025-03-05",
    photos: [],
    userType: "Owner" // For delivered units
  }
];

// Not Delivered Owner specific complaints
export const preConstructionComplaints = [
  {
    id: "CMP-PC-2025-0003",
    type: "Construction Delay",
    subject: "تأخير في مواعيد التسليم",
    description: "تأخر البناء عن الجدول الزمني المتفق عليه بأسبوعين",
    status: "Reviewing",
    date: "2025-03-08",
    photos: []
  },
  {
    id: "CMP-PC-2025-0001",
    type: "Quality",
    subject: "جودة أعمال البناء",
    description: "ملاحظات على جودة التشطيبات في الزيارة الأخيرة",
    status: "Resolved",
    date: "2025-02-28",
    photos: []
  }
];

export const violations = [
  {
    id: "VIO-2025-0003",
    type: "Parking Violation",
    description: "Parking in unauthorized zone",
    date: "2025-03-08",
    fine: 500,
    status: "Pending Payment",
    currency: "EGP",
    evidence: []
  }
];

// Contractor violations - For construction/worker violations
export const contractorViolations = [
  {
    id: "CV-2025-001",
    type: "Worker Safety Violation",
    description: "Worker found without safety helmet on site",
    workerName: "Ali Mohamed Hassan",
    workerId: "WKR-001",
    location: "Villa A-125 - Construction Site",
    date: "2025-03-10",
    time: "10:30 AM",
    reportedBy: "Security Officer - Ahmed Salah",
    fine: 1000,
    status: "Acknowledged",
    severity: "Medium",
    currency: "EGP",
    evidence: ["https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop"],
    notes: "First offense - Warning issued"
  },
  {
    id: "CV-2025-002",
    type: "Material Storage Violation",
    description: "Construction materials blocking common walkway",
    location: "Villa A-125 - Front entrance",
    date: "2025-03-08",
    time: "02:15 PM",
    reportedBy: "Compound Management",
    fine: 1500,
    status: "Pending Payment",
    severity: "High",
    currency: "EGP",
    evidence: ["https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&h=300&fit=crop"],
    notes: "Materials must be moved within 24 hours"
  },
  {
    id: "CV-2025-003",
    type: "Noise Violation",
    description: "Construction work during prohibited hours (after 6 PM)",
    location: "Villa A-125",
    date: "2025-03-05",
    time: "07:30 PM",
    reportedBy: "Resident Complaint - Villa A-124",
    fine: 2000,
    status: "Paid",
    severity: "High",
    currency: "EGP",
    paidDate: "2025-03-06",
    evidence: [],
    notes: "Repeated offense - Final warning"
  },
  {
    id: "CV-2025-004",
    type: "Unauthorized Access",
    description: "Worker attempted entry without valid permit",
    workerName: "Hassan Ibrahim Ali",
    workerId: "WKR-002",
    location: "Main Gate - Karma Gates",
    date: "2025-03-12",
    time: "07:00 AM",
    reportedBy: "Security - Main Gate",
    fine: 500,
    status: "Resolved",
    severity: "Low",
    currency: "EGP",
    evidence: [],
    notes: "Permit was expired - Renewed same day"
  },
  {
    id: "CV-2025-005",
    type: "Waste Disposal Violation",
    description: "Construction debris not disposed in designated area",
    location: "Villa A-125",
    date: "2025-03-11",
    time: "04:00 PM",
    reportedBy: "Environmental Officer",
    fine: 800,
    status: "Acknowledged",
    severity: "Medium",
    currency: "EGP",
    evidence: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop"],
    notes: "Must use designated waste containers"
  }
];

export const bills = [
  {
    id: "ELEC-2025-02",
    type: "Electricity",
    amount: 450,
    dueDate: "2025-03-20",
    status: "Unpaid",
    currency: "EGP"
  },
  {
    id: "WAT-2025-02",
    type: "Water",
    amount: 180,
    dueDate: "2025-03-20",
    status: "Unpaid",
    currency: "EGP"
  },
  {
    id: "MAIN-2025-03",
    type: "Maintenance Fee",
    amount: 1200,
    dueDate: "2025-03-15",
    status: "Unpaid",
    currency: "EGP"
  },
  {
    id: "ELEC-2025-01",
    type: "Electricity",
    amount: 420,
    dueDate: "2025-02-20",
    status: "Paid",
    paidDate: "2025-02-18",
    currency: "EGP"
  }
];

export const nearbyPlaces = [
  {
    id: 1,
    name: "Cairo Medical Center",
    category: "Hospital",
    distance: "2.3 km",
    rating: 4.5,
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop",
    lat: 30.0444,
    lng: 31.2357
  },
  {
    id: 2,
    name: "Al Karma International School",
    category: "School",
    distance: "1.8 km",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=300&fit=crop",
    lat: 30.0454,
    lng: 31.2367
  },
  {
    id: 3,
    name: "City Mall",
    category: "Shopping",
    distance: "3.5 km",
    rating: 4.3,
    image: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400&h=300&fit=crop",
    lat: 30.0434,
    lng: 31.2387
  },
  {
    id: 4,
    name: "La Piazza Restaurant",
    category: "Restaurant",
    distance: "1.2 km",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
    lat: 30.0464,
    lng: 31.2347
  }
];

export const qrHistory = [
  {
    id: "QR-V-2025-034",
    type: "Visitor",
    name: "Mohamed Ibrahim",
    phone: "+20 111 222 3333",
    date: "2025-03-13",
    time: "18:00",
    status: "Used",
    purpose: "Family Visit"
  },
  {
    id: "QR-D-2025-089",
    type: "Delivery",
    company: "Aramex",
    date: "2025-03-12",
    status: "Used"
  },
  {
    id: "QR-R-2025-012",
    type: "Ride",
    service: "Uber",
    date: "2025-03-11",
    status: "Expired"
  }
];

export const familyMembers = [
  {
    id: "USR-004",
    name: "Omar Ahmed Hassan",
    email: "omar.hassan@email.com",
    relation: "Son",
    phone: "+20 100 111 2222",
    nationalId: "30501011234569",
    parentUserId: "USR-001", // Owner Ahmed Hassan
    hasAppAccess: true,
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop",
    permissions: {
      qrCodes: true,
      services: ["gym", "pool", "clubhouse"],
      complaints: false,
      payments: false,
      smartHome: false,
      cameras: false
    }
  },
  {
    id: "USR-005",
    name: "Laila Hassan Mohamed",
    email: "laila.hassan@email.com",
    relation: "Spouse",
    phone: "+20 100 987 6543",
    nationalId: "29601011234572",
    parentUserId: "USR-001", // Owner Ahmed Hassan
    hasAppAccess: true,
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
    permissions: {
      qrCodes: true,
      services: ["maintenance", "cleaning", "gym", "pool", "clubhouse"],
      complaints: true,
      payments: true,
      smartHome: true,
      cameras: true
    }
  }
];

export const authorizedPersons = [
  {
    id: "USR-006",
    name: "Youssef Hassan Ibrahim",
    type: "Authorized User",
    email: "youssef.hassan@email.com",
    phone: "+20 100 777 8888",
    nationalId: "29201011234570",
    parentUserId: "USR-001", // Owner Ahmed Hassan
    relationship: "Brother",
    powerOfAttorney: true,
    attorneyDocument: "POA-2024-125.pdf",
    validUntil: "2026-12-31",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    hasFullAccess: true
  }
];

export const contractors = [
  {
    id: "USR-007",
    name: "Mahmoud Kamal Construction",
    companyName: "Mahmoud Kamal Construction",
    type: "Contractor",
    email: "mahmoud.builder@email.com",
    phone: "+20 122 333 4444",
    nationalId: "28801011234571",
    parentUserId: "USR-001", // Owner Ahmed Hassan
    service: "General Contracting",
    license: "LIC-123456",
    approvalStatus: "Approved",
    approvalDate: "2025-01-15",
    validUntil: "2025-12-31",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop",
    workers: ["WKR-001", "WKR-002"]
  }
];

export const workers = [
  {
    id: "WKR-001",
    name: "Ali Mohamed Hassan",
    phone: "+20 111 222 3333",
    nationalId: "29101011234573",
    idPhoto: "https://images.unsplash.com/photo-1545167622-3a6ac756afa4?w=150&h=150&fit=crop",
    contractorId: "USR-007",
    trade: "Electrician",
    permitStatus: "Active",
    validFrom: "2025-03-01",
    validUntil: "2025-06-01",
    accessType: "Daily"
  },
  {
    id: "WKR-002",
    name: "Hassan Ibrahim Ali",
    phone: "+20 111 333 4444",
    nationalId: "29201011234574",
    idPhoto: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&h=150&fit=crop",
    contractorId: "USR-007",
    trade: "Plumber",
    permitStatus: "Active",
    validFrom: "2025-03-01",
    validUntil: "2025-06-01",
    accessType: "Daily"
  }
];

export const leases = [
  {
    id: "LEASE-001",
    unitId: "UNIT-002",
    unitNumber: "Apartment B-203",
    compound: "Karma",
    landlordId: "USR-010",
    landlordName: "Mohamed Ibrahim Ahmed",
    tenantId: "USR-002",
    tenantName: "Sara Mahmoud Ali",
    tenantPhone: "+20 101 987 6543",
    tenantEmail: "sara.mahmoud@email.com",
    tenantNationalId: "29403021234568",
    contractDocument: "LEASE-2025-203.pdf",
    idDocument: "ID-Sara-Mahmoud.pdf",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    monthlyRent: 5000,
    depositAmount: 10000,
    status: "Active",
    daysRemaining: 292,
    autoRenew: false,
    permissions: {
      qrCodes: true,
      services: ["maintenance", "cleaning", "gym", "pool"],
      complaints: true,
      payments: true
    }
  }
];

export const smartHomeDevices = [
  {
    id: "DEV-001",
    name: "Living Room Lights",
    type: "Lighting",
    room: "Living Room",
    status: "On",
    value: 80, // brightness percentage
    icon: "💡"
  },
  {
    id: "DEV-002",
    name: "Main AC",
    type: "Climate",
    room: "Master Bedroom",
    status: "On",
    value: 22, // temperature in celsius
    icon: "❄️"
  },
  {
    id: "DEV-003",
    name: "Front Door Lock",
    type: "Security",
    room: "Entrance",
    status: "Locked",
    value: 100,
    icon: "🔒"
  },
  {
    id: "DEV-004",
    name: "Living Room Curtains",
    type: "Curtains",
    room: "Living Room",
    status: "Open",
    value: 100, // open percentage
    icon: "🪟"
  }
];

export const securityCameras = [
  {
    id: "CAM-001",
    name: "Main Gate Camera",
    location: "Compound Main Gate",
    type: "Fixed",
    status: "Active",
    isLive: true,
    thumbnail: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=400&h=300&fit=crop",
    hasMotionDetection: true,
    hasNightVision: true,
    addedBy: "Admin",
    canControl: false
  },
  {
    id: "CAM-002",
    name: "Front Door Camera",
    location: "Villa A-125 - Front Door",
    type: "Doorbell",
    status: "Active",
    isLive: true,
    thumbnail: "https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=300&fit=crop",
    hasMotionDetection: true,
    hasNightVision: true,
    addedBy: "Owner",
    canControl: true
  },
  {
    id: "CAM-003",
    name: "Backyard Camera",
    location: "Villa A-125 - Backyard",
    type: "PTZ",
    status: "Active",
    isLive: true,
    thumbnail: "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=400&h=300&fit=crop",
    hasMotionDetection: true,
    hasNightVision: true,
    addedBy: "Owner",
    canControl: true
  }
];

export const emergencyContacts = [
  {
    id: "EMG-001",
    name: "Security Office",
    phone: "+20 2 1234 5678",
    type: "Security",
    available24: true
  },
  {
    id: "EMG-002",
    name: "Maintenance Emergency",
    phone: "+20 2 1234 5679",
    type: "Maintenance",
    available24: true
  },
  {
    id: "EMG-003",
    name: "Medical Emergency",
    phone: "123",
    type: "Medical",
    available24: true
  },
  {
    id: "EMG-004",
    name: "Fire Department",
    phone: "180",
    type: "Fire",
    available24: true
  }
];

export const chatMessages = [
  {
    id: "MSG-001",
    sender: "Support Agent",
    senderType: "admin",
    message: "Hello! How can I help you today?",
    timestamp: "2025-03-13 14:30",
    read: true
  },
  {
    id: "MSG-002",
    sender: "Ahmed Hassan",
    senderType: "user",
    message: "I need help with my maintenance request",
    timestamp: "2025-03-13 14:32",
    read: true
  },
  {
    id: "MSG-003",
    sender: "Support Agent",
    senderType: "admin",
    message: "Sure! Can you please provide your request number?",
    timestamp: "2025-03-13 14:33",
    read: true
  }
];

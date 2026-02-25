import { useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, MapPin, Star, Navigation } from "lucide-react";
import { nearbyPlaces } from "../../data/mockData";

interface ExploreScreenProps {
  onBack: () => void;
}

export function ExploreScreen({ onBack }: ExploreScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { id: "all", label: "All", icon: "🗺️" },
    { id: "Hospital", label: "Hospitals", icon: "🏥" },
    { id: "School", label: "Schools", icon: "🏫" },
    { id: "Shopping", label: "Shopping", icon: "🛍️" },
    { id: "Restaurant", label: "Restaurants", icon: "🍽️" },
  ];

  const filteredPlaces = nearbyPlaces.filter(place => {
    const matchesCategory = selectedCategory === "all" || place.category === selectedCategory;
    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm">
        <button onClick={onBack} className="text-[#2a3e35] mb-4">
          ← Back
        </button>
        <h2 className="text-[#1E293B] mb-2">Explore Nearby</h2>
        <p className="text-[#64748B] mb-4">Discover places around Al Karma</p>
        
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search places..."
            className="pl-12 h-12 rounded-2xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      {/* Map View */}
      <div className="px-6 mt-6">
        <Card className="h-48 rounded-2xl overflow-hidden border-0 shadow-sm relative">
          <img
            src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&h=400&fit=crop"
            alt="Map"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-4">
            <Button className="bg-white text-[#2a3e35] hover:bg-white/90 h-10 rounded-xl">
              <MapPin className="w-4 h-4 mr-2" />
              Open in Maps
            </Button>
          </div>
        </Card>
      </div>

      {/* Categories */}
      <div className="px-6 py-4 overflow-x-auto">
        <div className="flex space-x-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors flex items-center space-x-2 ${
                selectedCategory === category.id
                  ? "bg-[#2a3e35] text-white"
                  : "bg-white text-[#64748B]"
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Places List */}
      <div className="px-6 space-y-4">
        {filteredPlaces.map((place) => (
          <Card key={place.id} className="p-0 bg-white rounded-2xl shadow-sm border-0 overflow-hidden">
            <div className="flex">
              <img
                src={place.image}
                alt={place.name}
                className="w-24 h-24 object-cover"
              />
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-[#1E293B] mb-1">{place.name}</h4>
                    <p className="text-sm text-[#64748B]">{place.category}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                    <span className="text-sm text-[#1E293B]">{place.rating}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-sm text-[#64748B]">
                    <MapPin className="w-4 h-4" />
                    <span>{place.distance}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg text-[#2a3e35]"
                  >
                    <Navigation className="w-4 h-4 mr-1" />
                    Directions
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredPlaces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-[#1E293B] mb-2">No Places Found</h3>
          <p className="text-[#64748B] text-center">
            Try adjusting your search or filter
          </p>
        </div>
      )}
    </div>
  );
}

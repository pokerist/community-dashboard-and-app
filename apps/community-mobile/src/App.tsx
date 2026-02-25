import { useState, useEffect } from "react";
import { SplashScreen } from "./components/auth/SplashScreen";
import { OnboardingScreen } from "./components/auth/OnboardingScreen";
import { LoginScreen } from "./components/auth/LoginScreen";
import { RegisterScreen } from "./components/auth/RegisterScreen";
import { HomeScreen } from "./components/screens/HomeScreen";
import { ServicesScreen } from "./components/screens/ServicesScreen";
import { QRCodesScreen } from "./components/screens/QRCodesScreen";
import { NotificationsScreen } from "./components/screens/NotificationsScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { ComplaintsScreen } from "./components/screens/ComplaintsScreen";
import { PaymentsScreen } from "./components/screens/PaymentsScreen";
import { ExploreScreen } from "./components/screens/ExploreScreen";
import { FamilyMembersScreen } from "./components/screens/FamilyMembersScreen";
import { ContractorsScreen } from "./components/screens/ContractorsScreen";
import { WorkersScreen } from "./components/screens/WorkersScreen";
import { ViolationsScreen } from "./components/screens/ViolationsScreen";
import { EmergencyScreen } from "./components/screens/EmergencyScreen";
import { SmartHomeScreen } from "./components/screens/SmartHomeScreen";
import { CamerasScreen } from "./components/screens/CamerasScreen";
import { ChatScreen } from "./components/screens/ChatScreen";
import { LeaseManagementScreen } from "./components/screens/LeaseManagementScreen";
import { ScheduleMeetingScreen } from "./components/screens/ScheduleMeetingScreen";
import { DelegationScreen } from "./components/screens/DelegationScreen";
import { RequestsScreen } from "./components/screens/RequestsScreen";
import { BottomNavigation } from "./components/layout/BottomNavigation";
import { DrawerMenu } from "./components/layout/DrawerMenu";
import { Toaster } from "./components/ui/sonner";
import { notifications } from "./data/mockData";

type AppState = "splash" | "onboarding" | "login" | "register" | "main";
type MainScreen = "home" | "services" | "qr" | "notifications" | "profile" | "complaints" | "payments" | "explore" | "family" | "contractors" | "workers" | "violations" | "emergency" | "smarthome" | "cameras" | "chat" | "lease" | "schedule-meeting" | "delegation" | "requests";

export default function App() {
  const [appState, setAppState] = useState<AppState>("splash");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainScreen>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screenParams, setScreenParams] = useState<any>(null);

  // Get current unit data
  const getCurrentUnit = () => {
    if (!currentUser?.units || currentUser.units.length === 0) return null;
    if (!selectedUnitId) return currentUser.units[0];
    return currentUser.units.find((u: any) => u.id === selectedUnitId) || currentUser.units[0];
  };

  const currentUnit = getCurrentUnit();

  // Update user's current unit and compound when unit changes
  const userWithCurrentUnit = currentUser ? {
    ...currentUser,
    unit: currentUnit?.number || currentUser.unit,
    compound: currentUnit?.compound || currentUser.compound,
    unitStatus: currentUnit?.status || currentUser.unitStatus,
    hasSmartHome: currentUnit?.hasSmartHome ?? currentUser.hasSmartHome,
    hasCameras: currentUnit?.hasCameras ?? currentUser.hasCameras
  } : null;

  // Splash screen timer
  useEffect(() => {
    if (appState === "splash") {
      const timer = setTimeout(() => {
        setAppState("onboarding");
      }, 5000); // 5 seconds to enjoy the video
      return () => clearTimeout(timer);
    }
  }, [appState]);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
    // Set first unit as default
    if (user.units && user.units.length > 0) {
      setSelectedUnitId(user.units[0].id);
    }
    setAppState("main");
  };

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    setDrawerOpen(false);
  };

  const handleRegister = (userData: any) => {
    setCurrentUser(userData);
    setAppState("main");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAppState("login");
    setActiveTab("home");
  };

  const handleNavigate = (screen: MainScreen, params?: any) => {
    setActiveTab(screen);
    if (params) {
      setScreenParams(params);
    } else {
      setScreenParams(null);
    }
    setDrawerOpen(false);
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Render authentication flow
  if (appState === "splash") {
    return <SplashScreen />;
  }

  if (appState === "onboarding") {
    return <OnboardingScreen onComplete={() => setAppState("login")} />;
  }

  if (appState === "login") {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={() => setAppState("register")}
      />
    );
  }

  if (appState === "register") {
    return (
      <RegisterScreen
        onRegister={handleRegister}
        onBack={() => setAppState("login")}
      />
    );
  }

  // Render main app
  return (
    <div className="relative min-h-screen bg-[#F9FAFB] max-w-lg mx-auto">
      {/* Drawer Menu */}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={userWithCurrentUnit}
        currentUnit={currentUnit}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onUnitChange={handleUnitChange}
      />

      {/* Main Content */}
      <div className="relative">
        {activeTab === "home" && (
          <HomeScreen
            user={userWithCurrentUnit}
            currentUnit={currentUnit}
            onMenuOpen={() => setDrawerOpen(true)}
            onNavigate={handleNavigate}
            onUnitChange={handleUnitChange}
          />
        )}

        {activeTab === "services" && (
          <ServicesScreen
            user={userWithCurrentUnit}
            onServiceSelect={(serviceId) => {
              // Handle navigation from services
              if (serviceId === "delegation") {
                handleNavigate("delegation");
              } else if (serviceId === "contractors") {
                handleNavigate("contractors");
              }
            }}
          />
        )}

        {activeTab === "qr" && (
          <QRCodesScreen user={userWithCurrentUnit} onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "notifications" && (
          <NotificationsScreen />
        )}

        {activeTab === "profile" && (
          <ProfileScreen
            user={userWithCurrentUnit}
            currentUnit={currentUnit}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === "complaints" && (
          <ComplaintsScreen 
            user={userWithCurrentUnit}
            onBack={() => handleNavigate("home")} 
          />
        )}

        {activeTab === "payments" && (
          <PaymentsScreen onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "explore" && (
          <ExploreScreen onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "family" && (
          <FamilyMembersScreen 
            user={userWithCurrentUnit}
            onBack={() => handleNavigate("profile")} 
          />
        )}

        {activeTab === "contractors" && (
          <ContractorsScreen 
            user={userWithCurrentUnit}
            onBack={() => handleNavigate("profile")}
            onViewWorkers={(contractorId) => {
              setScreenParams({ contractorId });
              handleNavigate("workers");
            }}
          />
        )}

        {activeTab === "workers" && (
          <WorkersScreen 
            contractorId={screenParams?.contractorId}
            onBack={() => {
              // If came from profile (contractor), go back to profile
              if (userWithCurrentUnit?.accountType === "Contractor") {
                handleNavigate("profile");
              } else {
                // Otherwise go to contractors screen
                handleNavigate("contractors");
              }
            }}
          />
        )}

        {activeTab === "violations" && userWithCurrentUnit?.accountType !== "Not Delivered Owner" && (
          <ViolationsScreen user={userWithCurrentUnit} onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "emergency" && (
          <EmergencyScreen user={userWithCurrentUnit} onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "smarthome" && (
          <SmartHomeScreen onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "cameras" && (
          <CamerasScreen onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "chat" && (
          <ChatScreen user={userWithCurrentUnit} onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "lease" && (
          <LeaseManagementScreen onBack={() => handleNavigate("profile")} />
        )}

        {activeTab === "schedule-meeting" && (
          <ScheduleMeetingScreen onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "delegation" && (
          <DelegationScreen onBack={() => handleNavigate("home")} />
        )}

        {activeTab === "requests" && (
          <RequestsScreen onBack={() => handleNavigate("home")} user={userWithCurrentUnit} />
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={(tab) => handleNavigate(tab as MainScreen)}
        user={userWithCurrentUnit}
      />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}

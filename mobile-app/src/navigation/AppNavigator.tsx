import React, { useMemo } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../theme/ThemeContext';
import { fontSize, fontWeight } from '../theme/tokens';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import LedgerScreen from '../screens/LedgerScreen';
import PlannerScreen from '../screens/PlannerScreen';
import SystemScreen from '../screens/SystemScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import AlertsScreen from '../screens/AlertsScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import SpendingStoryScreen from '../screens/SpendingStoryScreen';
import CalendarSyncScreen from '../screens/CalendarSyncScreen';
import BadgesStreaksScreen from '../screens/BadgesStreaksScreen';
import ManageWidgetsScreen from '../screens/ManageWidgetsScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import QuickSplitScreen from '../screens/QuickSplitScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', Ledger: '📒', Planner: '📋', System: '⚙️',
  };
  const icon = icons[label] || '📄';
  return (
    <View style={{ alignItems: 'center', opacity: focused ? 1 : 0.5 }} accessibilityLabel={label} accessibilityRole="tab">
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </View>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 28, paddingTop: 8, height: 76 },
          tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Ledger" component={LedgerScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="System" component={SystemScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

export default function AppNavigator() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [initializing, setInitializing] = React.useState(true);

  const defaultHeader = useMemo(() => ({
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: fontWeight.semibold, fontSize: fontSize.lg },
  }), [colors]);

  React.useEffect(() => {
    const init = async () => {
      await loadUser();
      setInitializing(false);
    };
    init();
  }, []);

  if (initializing || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Categories" component={CategoriesScreen} options={{ headerShown: true, title: 'Categories', ...defaultHeader }} />
            <Stack.Screen name="Alerts" component={AlertsScreen} options={{ headerShown: true, title: 'Alerts', ...defaultHeader }} />
            <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ headerShown: true, title: 'Analysis', ...defaultHeader }} />
            <Stack.Screen name="SpendingStory" component={SpendingStoryScreen} options={{ headerShown: true, title: 'Your Month', ...defaultHeader }} />
            <Stack.Screen name="CalendarSync" component={CalendarSyncScreen} options={{ headerShown: true, title: 'Calendar Sync', ...defaultHeader }} />
            <Stack.Screen name="BadgesStreaks" component={BadgesStreaksScreen} options={{ headerShown: true, title: 'Badges & Streaks', ...defaultHeader }} />
            <Stack.Screen name="ManageWidgets" component={ManageWidgetsScreen} options={{ headerShown: true, title: 'Manage Widgets', ...defaultHeader }} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ presentation: 'modal', headerShown: true, title: 'Add Transaction', ...defaultHeader }} />
            <Stack.Screen name="QuickSplit" component={QuickSplitScreen} options={{ presentation: 'modal', headerShown: true, title: 'Split Transaction', ...defaultHeader }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ animationTypeForReplace: 'pop' }} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

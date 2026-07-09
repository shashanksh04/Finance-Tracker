import React from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { colors, fontSize, fontWeight } from '../theme/tokens';

const defaultHeader = { headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: fontWeight.semibold, fontSize: fontSize.lg } };

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import AccountsScreen from '../screens/AccountsScreen';
import MoreScreen from '../screens/MoreScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import BillsScreen from '../screens/BillsScreen';
import RecurringScreen from '../screens/RecurringScreen';
import AlertsScreen from '../screens/AlertsScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import CopilotScreen from '../screens/CopilotScreen';
import CameraOCRScreen from '../screens/CameraOCRScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StreaksScreen from '../screens/StreaksScreen';
import BadgesScreen from '../screens/BadgesScreen';
import SpendingStoryScreen from '../screens/SpendingStoryScreen';
import AddTransactionScreen from '../screens/AddTransactionScreen';
import CalendarSyncScreen from '../screens/CalendarSyncScreen';
import SmsImportScreen from '../screens/SmsImportScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '🏠', Transactions: '💳', Accounts: '🏦', More: '☰',
  };
  const icon = icons[label] || '📄';
  return (
    <View style={{ alignItems: 'center', opacity: focused ? 1 : 0.5 }} accessibilityLabel={label} accessibilityRole="tab">
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f8fafc' }}>
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
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Transactions" component={TransactionsScreen} />
        <Tab.Screen name="Accounts" component={AccountsScreen} />
        <Tab.Screen name="More" component={MoreScreen} />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [initializing, setInitializing] = React.useState(true);

  React.useEffect(() => {
    const init = async () => {
      await loadUser();
      setInitializing(false);
    };
    init();
  }, []);

  if (initializing || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0284c7" />
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
            <Stack.Screen name="Budgets" component={BudgetsScreen} options={{ headerShown: true, title: 'Budgets', ...defaultHeader }} />
            <Stack.Screen name="Goals" component={GoalsScreen} options={{ headerShown: true, title: 'Goals', ...defaultHeader }} />
            <Stack.Screen name="Bills" component={BillsScreen} options={{ headerShown: true, title: 'Bills', ...defaultHeader }} />
            <Stack.Screen name="Recurring" component={RecurringScreen} options={{ headerShown: true, title: 'Recurring', ...defaultHeader }} />
            <Stack.Screen name="Alerts" component={AlertsScreen} options={{ headerShown: true, title: 'Alerts', ...defaultHeader }} />
            <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ headerShown: true, title: 'Analysis', ...defaultHeader }} />
            <Stack.Screen name="Copilot" component={CopilotScreen} options={{ headerShown: true, title: 'AI Copilot', ...defaultHeader }} />
            <Stack.Screen name="CameraOCR" component={CameraOCRScreen} options={{ headerShown: true, title: 'Scan Receipt', ...defaultHeader }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', ...defaultHeader }} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ headerShown: true, title: 'Add Transaction', ...defaultHeader }} />
            <Stack.Screen name="Streaks" component={StreaksScreen} options={{ headerShown: true, title: 'Streaks', ...defaultHeader }} />
            <Stack.Screen name="Badges" component={BadgesScreen} options={{ headerShown: true, title: 'Badges', ...defaultHeader }} />
            <Stack.Screen name="SpendingStory" component={SpendingStoryScreen} options={{ headerShown: true, title: 'Your Month', ...defaultHeader }} />
            <Stack.Screen name="CalendarSync" component={CalendarSyncScreen} options={{ headerShown: true, title: 'Calendar Sync', ...defaultHeader }} />
            <Stack.Screen name="SmsImport" component={SmsImportScreen} options={{ headerShown: true, title: 'Import from SMS', ...defaultHeader }} />
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

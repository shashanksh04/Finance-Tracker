import React from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';

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

function PlaceholderScreen({ route }: any) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
      <Text style={{ fontSize: 18, color: '#0f172a', fontWeight: '600' }}>{route?.name || 'Screen'}</Text>
      <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Coming soon</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '🏠', Transactions: '💳', Accounts: '🏦', More: '☰',
  };
  const icon = icons[label] || '📄';
  return (
    <View style={{ alignItems: 'center', opacity: focused ? 1 : 0.5 }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: '#0284c7',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e2e8f0', paddingBottom: 8, paddingTop: 8, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="More" component={MoreScreen} />
    </Tab.Navigator>
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
            <Stack.Screen name="Categories" component={CategoriesScreen} options={{ headerShown: true, title: 'Categories', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Budgets" component={BudgetsScreen} options={{ headerShown: true, title: 'Budgets', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Goals" component={GoalsScreen} options={{ headerShown: true, title: 'Goals', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Bills" component={BillsScreen} options={{ headerShown: true, title: 'Bills', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Recurring" component={RecurringScreen} options={{ headerShown: true, title: 'Recurring', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Alerts" component={AlertsScreen} options={{ headerShown: true, title: 'Alerts', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ headerShown: true, title: 'Analysis', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Copilot" component={CopilotScreen} options={{ headerShown: true, title: 'AI Copilot', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="CameraOCR" component={CameraOCRScreen} options={{ headerShown: true, title: 'Scan Receipt', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', headerStyle: { backgroundColor: '#fff' }, headerTintColor: '#0f172a' }} />
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

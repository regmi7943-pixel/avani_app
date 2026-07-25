import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import FarmsScreen from '../screens/main/FarmsScreen';
import AIAssistantScreen from '../screens/main/AIAssistantScreen';
import ScanScreen from '../screens/main/ScanScreen';
import TutorialScreen from '../screens/main/TutorialScreen';
import MarketplaceScreen from '../screens/main/MarketplaceScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

import CustomTabBar from '../components/CustomTabBar';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={FarmsScreen} />
      <Tab.Screen name="AI Assistant" component={AIAssistantScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Tutorial" component={TutorialScreen} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

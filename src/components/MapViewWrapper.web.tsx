import React from 'react';
import { View, Text } from 'react-native';

export const MapView: any = (props: any) => (
  <View style={[{ backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', padding: 16 }, props.style]}>
    <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>
      🗺️ Farm Location Map (Web Preview)
    </Text>
  </View>
);

export const Marker: any = () => null;
export const Polygon: any = () => null;
export const Polyline: any = () => null;
export const MapPolygon: any = () => null;
export const PROVIDER_DEFAULT: any = 'default';

export default MapView;

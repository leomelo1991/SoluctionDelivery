export interface MapPoint {
  latitude: number;
  longitude: number;
}
export interface OperationsMapPin {
  id: string;
  kind: 'establishment' | 'pickup' | 'dropoff';
  label: string;
  address: string;
  active: boolean;
  point: MapPoint | null;
  locationStatus: 'ready' | 'pending' | 'unavailable';
  deliveryId?: string;
  courierId?: string;
}
export interface OperationsMapSnapshot {
  generatedAt: string;
  geocodingEnabled: boolean;
  truncated: boolean;
  pins: OperationsMapPin[];
  couriers: Array<{
    id: string;
    name: string;
    point: MapPoint;
    accuracy: number;
    observedAt: string;
    availability: string;
    leg: 'pickup' | 'dropoff' | null;
    deliveryId: string | null;
  }>;
}

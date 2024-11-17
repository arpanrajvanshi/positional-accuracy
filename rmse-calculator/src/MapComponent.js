import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create custom icons
const redIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [32, 32],
});

const greenIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [32, 32],
});

// Component to fit bounds of markers on the map
const FitBounds = ({ measuredPoints, referencePoints }) => {
  const map = useMap();

  useEffect(() => {
    if (measuredPoints.length > 0 || referencePoints.length > 0) {
      const allPoints = [...measuredPoints, ...referencePoints];
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds);
    }
  }, [measuredPoints, referencePoints, map]);

  return null;
};

const MapComponent = ({ measuredPoints, referencePoints }) => {
  return (
    <MapContainer
      center={[0, 0]}
      zoom={2}
      style={{ height: '400px', width: '80%', margin: 'auto', marginTop: '20px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FitBounds measuredPoints={measuredPoints} referencePoints={referencePoints} />
      {measuredPoints.map((position, index) => (
        <Marker key={`measured-${index}`} position={position} icon={redIcon}>
          <Tooltip>
            Measured Point {index + 1}
            <br />
            Latitude: {position[0]}
            <br />
            Longitude: {position[1]}
          </Tooltip>
        </Marker>
      ))}
      {referencePoints.map((position, index) => (
        <Marker key={`reference-${index}`} position={position} icon={greenIcon}>
          <Tooltip>
            Reference Point {index + 1}
            <br />
            Latitude: {position[0]}
            <br />
            Longitude: {position[1]}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;

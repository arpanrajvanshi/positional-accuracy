// MapComponent.js

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Define custom icons
const redIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  iconSize: [32, 32],
});

const greenIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  iconSize: [32, 32],
});

const blackIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/black-dot.png',
  iconSize: [32, 32],
});

const blueIcon = new L.Icon({
  iconUrl: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  iconSize: [32, 32],
});

// Component to fit bounds of markers on the map
const FitBounds = ({ measuredPoints, referencePoints }) => {
  const map = useMap();

  useEffect(() => {
    if (measuredPoints.length > 0 || referencePoints.length > 0) {
      const allPoints = [
        ...measuredPoints.map((point) => point.position),
        ...referencePoints.map((point) => point.position),
      ];
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds);
    }
  }, [measuredPoints, referencePoints, map]);

  return null;
};

const MapComponent = ({ measuredPoints, referencePoints, ce90, ce90Center, excludeOutliers }) => {
  // Calculate mean position of measured points (excluding outliers if needed)
  const includedMeasuredPoints = excludeOutliers
    ? measuredPoints.filter((point) => !point.isOutlier)
    : measuredPoints;

  let meanPosition = [0, 0];
  if (includedMeasuredPoints.length > 0) {
    meanPosition = [
      includedMeasuredPoints.reduce((sum, point) => sum + point.position[0], 0) /
        includedMeasuredPoints.length,
      includedMeasuredPoints.reduce((sum, point) => sum + point.position[1], 0) /
        includedMeasuredPoints.length,
    ];
  }

  return (
    <div className="map-wrapper">
      <MapContainer
        center={ce90Center || meanPosition}
        zoom={13}
        style={{ height: '400px', width: '100%', margin: 'auto', marginTop: '20px' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        <FitBounds measuredPoints={measuredPoints} referencePoints={referencePoints} />

        {/* Measured Points */}
        {measuredPoints.map((point, index) => (
          <Marker
            key={`measured-${index}`}
            position={point.position}
            icon={point.isOutlier ? blackIcon : redIcon}
          >
            <Tooltip>
              Measured Point {index + 1}
              <br />
              Latitude: {point.position[0]}
              <br />
              Longitude: {point.position[1]}
            </Tooltip>
          </Marker>
        ))}

        {/* Reference Points */}
        {referencePoints.map((point, index) => (
          <Marker
            key={`reference-${index}`}
            position={point.position}
            icon={measuredPoints[index].isOutlier ? blueIcon : greenIcon}
          >
            <Tooltip>
              Reference Point {index + 1}
              <br />
              Latitude: {point.position[0]}
              <br />
              Longitude: {point.position[1]}
            </Tooltip>
          </Marker>
        ))}

        {/* CE90 Circle */}
        {ce90 && ce90Center && (
          <Circle
            center={ce90Center}
            radius={ce90} // CE90 in meters
            pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
          >
            <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent={false}>
              CE90 Radius: {ce90.toFixed(2)} m
            </Tooltip>
          </Circle>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-item">
          <span className="legend-color red"></span>
          <span>Measured Points</span>
        </div>
        <div className="legend-item">
          <span className="legend-color green"></span>
          <span>Reference Points</span>
        </div>
      
      </div>
    </div>
  );
};

export default MapComponent;

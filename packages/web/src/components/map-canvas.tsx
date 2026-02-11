import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/** Watches the map container for size changes and calls invalidateSize. */
function ResizeHandler() {
  const map = useMap();
  const containerRef = useRef(map.getContainer());

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function MapCanvas({ className }: { className?: string }) {
  return (
    <MapContainer
      className={className}
      style={{ width: "100%", height: "100%", zIndex: 0 }}
      center={[0, 0]}
      zoom={2}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ResizeHandler />
    </MapContainer>
  );
}

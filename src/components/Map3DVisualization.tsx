import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface EmployeeLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  last_updated: string;
  battery_level?: number;
  connection_status?: 'online' | 'offline';
  location_accuracy?: number;
  accuracy?: number;
  task_id?: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  task_title?: string;
  task_status?: string;
  task_due_date?: string;
  activity_status?: 'active' | 'recently_active' | 'offline';
  timestamp?: string;
  speed?: number;
  heading?: number;
}

interface Map3DVisualizationProps {
  locations: EmployeeLocation[];
  isVisible: boolean;
  onClose: () => void;
}

export const Map3DVisualization: React.FC<Map3DVisualizationProps> = ({
  locations,
  isVisible,
  onClose
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const animationIdRef = useRef<number>();

  useEffect(() => {
    if (!isVisible || !mountRef.current || locations.length === 0) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x90EE90,
      transparent: true,
      opacity: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Calculate bounds for normalization
    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const maxRange = Math.max(latRange, lngRange);
    const scale = 100 / maxRange; // Scale to fit in 100x100 area

    // Create route path
    if (locations.length > 1) {
      const sortedLocations = [...locations].sort((a, b) => 
        new Date(a.last_updated || a.recorded_at || '').getTime() - 
        new Date(b.last_updated || b.recorded_at || '').getTime()
      );

      // Create path geometry
      const points: THREE.Vector3[] = [];
      sortedLocations.forEach((location, index) => {
        const x = (location.longitude - minLng) * scale - 50;
        const z = (location.latitude - minLat) * scale - 50;
        const y = Math.sin(index * 0.5) * 2; // Add some height variation
        points.push(new THREE.Vector3(x, y, z));
      });

      // Create line geometry
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x2980b9,
        linewidth: 3
      });
      const routeLine = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(routeLine);

      // Create markers for each location
      sortedLocations.forEach((location, index) => {
        const x = (location.longitude - minLng) * scale - 50;
        const z = (location.latitude - minLat) * scale - 50;
        const y = Math.sin(index * 0.5) * 2 + 1;

        // Create marker geometry
        const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        let markerMaterial: THREE.MeshLambertMaterial;

        if (index === 0) {
          // Start point - green
          markerMaterial = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });
        } else if (index === sortedLocations.length - 1) {
          // End point - red
          markerMaterial = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
        } else {
          // Intermediate points - blue
          markerMaterial = new THREE.MeshLambertMaterial({ color: 0x3498db });
        }

        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, y, z);
        marker.castShadow = true;
        scene.add(marker);

        // Add height lines
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0, z),
          new THREE.Vector3(x, y, z)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0x7f8c8d,
          transparent: true,
          opacity: 0.5
        });
        const heightLine = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(heightLine);
      });

      // Position camera to view the route
      const centerX = (minLng + maxLng) / 2;
      const centerZ = (minLat + maxLat) / 2;
      const centerWorldX = (centerX - minLng) * scale - 50;
      const centerWorldZ = (centerZ - minLat) * scale - 50;

      camera.position.set(centerWorldX + 30, 40, centerWorldZ + 30);
      camera.lookAt(centerWorldX, 0, centerWorldZ);
    }

    // Add some decorative elements
    // Trees
    for (let i = 0; i < 20; i++) {
      const treeGeometry = new THREE.CylinderGeometry(0.2, 0.3, 3, 8);
      const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
      const tree = new THREE.Mesh(treeGeometry, treeMaterial);
      
      const treeX = (Math.random() - 0.5) * 150;
      const treeZ = (Math.random() - 0.5) * 150;
      tree.position.set(treeX, 1.5, treeZ);
      tree.castShadow = true;
      scene.add(tree);

      // Tree top
      const topGeometry = new THREE.SphereGeometry(1, 8, 6);
      const topMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
      const top = new THREE.Mesh(topGeometry, topMaterial);
      top.position.set(treeX, 4, treeZ);
      top.castShadow = true;
      scene.add(top);
    }

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      // Rotate camera around the scene
      const time = Date.now() * 0.0005;
      const radius = 60;
      const centerX = (minLng + maxLng) / 2;
      const centerZ = (minLat + maxLat) / 2;
      const centerWorldX = (centerX - minLng) * scale - 50;
      const centerWorldZ = (centerZ - minLat) * scale - 50;

      camera.position.x = centerWorldX + Math.cos(time) * radius;
      camera.position.z = centerWorldZ + Math.sin(time) * radius;
      camera.position.y = 30 + Math.sin(time * 0.5) * 10;
      camera.lookAt(centerWorldX, 0, centerWorldZ);

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isVisible, locations]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold">3D Route Visualization</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="flex-1 p-4">
          <div className="mb-4 flex justify-center space-x-8">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm">Start Point</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
              <span className="text-sm">End Point</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm">Route Points</span>
            </div>
          </div>
          <div 
            ref={mountRef} 
            className="w-full h-full border rounded min-h-[500px]"
          />
        </div>
        <div className="p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            Interactive 3D visualization of employee route with {locations.length} location points
          </p>
        </div>
      </div>
    </div>
  );
};

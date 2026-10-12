/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Camera, 
  Map as MapIcon, 
  Layers, 
  Trash2, 
  Plus, 
  Minus, 
  RefreshCw, 
  ExternalLink, 
  Search, 
  X, 
  ChevronDown, 
  ChevronRight, 
  MousePointer2, 
  Undo,
  Check,
  FileBarChart2,
  Lock,
  Scissors,
  Square,
  Ruler,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache(),
});
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// --- Constants ---
const COLORS = [
  'rgba(59, 130, 246, 0.4)', 
  'rgba(16, 185, 129, 0.4)', 
  'rgba(245, 158, 11, 0.4)', 
  'rgba(236, 72, 153, 0.4)', 
  'rgba(139, 92, 246, 0.4)'
];

const MATERIALS = [
  'Decorative rock', 
  'Seating wall', 
  'Stamped concrete', 
  'Brushed concrete',
  'Artificial turf',
  'Sod/Natural grass',
  'Mulch/Bark',
  'Pavers',
  'Wood decking',
  'Composite decking',
  'Gravel'
];

interface Point {
  x: number;
  y: number;
}

interface Shape {
  name: string;
  areaPixels: number;
  areaSqFt: number;
  perimeterPixels?: number;
  perimeterFt?: number;
  color: string;
  image?: HTMLImageElement;
  points?: Point[];
  x?: number;
  y?: number;
  figmaId?: string;
  figmaType?: string;
  customId?: string;
  material?: string;
  measureMode: 'area' | 'length';
}

interface FigmaLayer {
  id: string;
  name: string;
  type: string;
  bbox: { x: number; y: number; width: number; height: number };
  depth: number;
  isLocked: boolean;
  isEffectivelyLocked: boolean;
  isEffectivelyVisible: boolean;
  isCalculating: boolean;
  ancestors: string[];
  isGroup: boolean;
  isExpanded: boolean;
  suggestedMaterial: string | null;
  geometry?: any[];
}

export default function App() {
  // --- States ---
  const [figmaPat, setFigmaPat] = useState(() => localStorage.getItem('figmaPat') || '');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [figmaLayers, setFigmaLayers] = useState<FigmaLayer[]>([]);
  const [hideLocked, setHideLocked] = useState(true);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [customShapeName, setCustomShapeName] = useState('');
  const [showScaleSettings, setShowScaleSettings] = useState(false);
  const [showMaterialSidesheet, setShowMaterialSidesheet] = useState(false);
  const [selectedShapeForMaterial, setSelectedShapeForMaterial] = useState<Shape | null>(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [figmaContext, setFigmaContext] = useState<{ fileKey: string; pat: string; frameBBox: any } | null>(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pixelsPerFoot, setPixelsPerFoot] = useState(12);

  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleSheetId, setGoogleSheetId] = useState(() => localStorage.getItem('googleSheetId') || '');
  const [isExporting, setIsExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(new Image());
  const colorIndexRef = useRef(0);

  useEffect(() => {
    // Test Firestore connection
    const testConnection = async () => {
      console.log("Testing Firestore connection to project:", firebaseConfig.projectId);
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firestore connection test result:", testDoc.exists() ? "Document exists" : "Document doesn't exist (but reachable)");
      } catch (error: any) {
        console.error("Firestore connection failure:", error);
        if (error.message?.includes('offline')) {
          setSyncStatus({ 
            message: "Firestore is reporting as offline. Please check your internet connection or refresh the page.", 
            type: 'error' 
          });
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setGoogleSheetId(userDoc.data().googleSheetId || '');
          }
        } catch (err) {
          console.error("Error loading sheet ID:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const saveSheetId = async (id: string) => {
    setGoogleSheetId(id);
    localStorage.setItem('googleSheetId', id);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { googleSheetId: id }, { merge: true });
      } catch (err) {
        console.error("Error saving sheet ID:", err);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleToken(credential.accessToken);
        setSyncStatus({ message: 'Successfully signed into Google!', type: 'success' });
      }
    } catch (error: any) {
      setSyncStatus({ message: 'Login failed: ' + error.message, type: 'error' });
    } finally {
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const exportToSheets = async () => {
    if (!googleToken) {
      handleGoogleLogin();
      return;
    }
    
    if (!googleSheetId) {
      setSyncStatus({ message: 'Please provide a Google Sheet ID or URL', type: 'error' });
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    setIsExporting(true);
    setSyncStatus({ message: 'Exporting to Google Sheets...', type: 'info' });

    try {
      const sheetId = googleSheetId.includes('/d/') 
        ? googleSheetId.split('/d/')[1]?.split('/')[0] 
        : googleSheetId;

      const rows: any[][] = [];
      // Surface areas
      Object.entries(summary.areas).forEach(([mat, val]) => {
        rows.push([mat, (val as number).toFixed(2), 'sqft']);
      });
      // Linear footages
      Object.entries(summary.perimeters).forEach(([mat, val]) => {
        rows.push([mat, (val as number).toFixed(2), 'ft']);
      });
      // Object inventory
      Object.entries(summary.objects).forEach(([name, count]) => {
        rows.push([name, count, 'unit']);
      });

      if (rows.length === 0) {
        throw new Error("No data to export.");
      }

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to export data.");
      }

      setSyncStatus({ message: 'Successfully exported to Google Sheets!', type: 'success' });
    } catch (error: any) {
      console.error(error);
      let message = error.message;
      if (message.includes('spreadsheets.googleapis.com') || message.includes('disabled')) {
        message = 'Google Sheets API is not enabled. Please [click here to enable it](https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=472487374153) and try again.';
      }
      setSyncStatus({ message, type: 'error' });
    } finally {
      setIsExporting(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // --- Helpers ---
  const calculatePolygonArea = (points: Point[]) => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        let j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  const calculatePathLength = (points: Point[], isClosed: boolean) => {
    let length = 0;
    const segments = isClosed ? points.length : points.length - 1;
    if (segments <= 0) return 0;
    
    for (let i = 0; i < segments; i++) {
        let j = (i + 1) % points.length;
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  };

  const calculateGeometryLength = (geometry: any[], isModeLength: boolean) => {
    let totalLength = 0;
    
    geometry.forEach(g => {
      if (!g.path) return;
      
      const commands = g.path.split(/(?=[MLCZ])/);
      let currentPos = { x: 0, y: 0 };
      let startPos = { x: 0, y: 0 };
      
      commands.forEach((cmd: string) => {
        const type = cmd[0];
        const args = cmd.slice(2).trim().split(/\s+/).map(Number);
        
        if (type === 'M') {
          currentPos = { x: args[0], y: args[1] };
          startPos = { ...currentPos };
        } else if (type === 'L') {
          const dx = args[0] - currentPos.x;
          const dy = args[1] - currentPos.y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
          currentPos = { x: args[0], y: args[1] };
        } else if (type === 'C') {
          const dx = args[4] - currentPos.x;
          const dy = args[5] - currentPos.y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
          currentPos = { x: args[4], y: args[5] };
        } else if (type === 'Z' && !isModeLength) {
          // Only add closing segment distance if we are measuring PERIMETER/AREA
          // For linear runs, 'Z' usually just closes the shape visually
          const dx = startPos.x - currentPos.x;
          const dy = startPos.y - currentPos.y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
          currentPos = { ...startPos };
        }
      });
    });
    
    return totalLength;
  };

  // --- Canvas Redraw Logic ---
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (imgRef.current.src) {
        ctx.drawImage(imgRef.current, 0, 0);
    }

    shapes.forEach(shape => {
        if (shape.image) {
            const tintCanvas = document.createElement('canvas');
            tintCanvas.width = shape.image.width;
            tintCanvas.height = shape.image.height;
            const tCtx = tintCanvas.getContext('2d');
            if (tCtx) {
              tCtx.drawImage(shape.image, 0, 0);
              tCtx.globalCompositeOperation = 'source-in';
              tCtx.fillStyle = shape.color;
              tCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
              
              ctx.save();
              ctx.drawImage(tintCanvas, shape.x || 0, shape.y || 0);
              ctx.strokeStyle = shape.color.replace('0.4', '1.0');
              ctx.lineWidth = 1;
              ctx.strokeRect(shape.x || 0, shape.y || 0, shape.image.width, shape.image.height);
              ctx.restore();
            }
        } else if (shape.points) {
            ctx.beginPath();
            ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) {
                ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = shape.color;
            ctx.fill();
            ctx.strokeStyle = shape.color.replace('0.4', '1.0');
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    if (currentPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
        for (let i = 1; i < currentPoints.length; i++) {
            ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
        }
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#2563eb';
        currentPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
  }, [shapes, currentPoints]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const resetView = useCallback(() => {
    setPanOffset({ x: 0, y: 0 });
    const container = document.getElementById('canvas-container');
    if (container && container.clientWidth > 0 && imgRef.current.complete) {
      const padding = 120;
      const scaleX = (container.clientWidth - padding) / imgRef.current.width;
      const scaleY = (container.clientHeight - padding) / imgRef.current.height;
      const autoZoom = Math.max(0.1, Math.min(2.0, Math.min(scaleX, scaleY)));
      setZoomLevel(autoZoom);
    }
  }, []);

  // --- Canvas Setup & Auto-Zoom ---
  useEffect(() => {
    if (isLoaded && canvasRef.current && imgRef.current.complete) {
      const canvas = canvasRef.current;
      canvas.width = imgRef.current.width;
      canvas.height = imgRef.current.height;
      
      const container = document.getElementById('canvas-container');
      if (container && container.clientWidth > 0) {
        const padding = 120;
        const scaleX = (container.clientWidth - padding) / imgRef.current.width;
        const scaleY = (container.clientHeight - padding) / imgRef.current.height;
        const autoZoom = Math.max(0.1, Math.min(2.0, Math.min(scaleX, scaleY)));
        setZoomLevel(autoZoom);
      }
      
      redrawCanvas();
    }
  }, [isLoaded, redrawCanvas]);

  // --- Figma Layer Processing ---
  const parseFigmaLayers = useCallback((node: any, frameBBox: any, stylesMap = {}) => {
    const validTypes = ['RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'VECTOR', 'BOOLEAN_OPERATION', 'GROUP', 'INSTANCE', 'FRAME', 'COMPONENT'];
    const layers: FigmaLayer[] = [];

    function traverse(n: any, depth: number, ancestorIds: string[], inheritedLock: boolean, inheritedVisible: boolean) {
        if (n.name && n.name.startsWith('.')) return;

        const currentAncestors = [...ancestorIds];
        if (n.id !== node.id) currentAncestors.push(n.id);

        const isExplicitlyLocked = !!n.locked;
        const isEffectivelyLocked = isExplicitlyLocked || inheritedLock;
        const isExplicitlyVisible = n.visible !== false;
        const isEffectivelyVisible = isExplicitlyVisible && inheritedVisible;

        const isValidType = validTypes.includes(n.type);
        const hasBoundingBox = !!n.absoluteBoundingBox;
        const isGroupLike = ['GROUP', 'FRAME', 'INSTANCE'].includes(n.type) || (n.children && n.children.length > 0);

        let suggestedMaterial: string | null = null;
        if (n.styles) {
            const styleId = n.styles.fill || n.styles.stroke;
            if (styleId && (stylesMap as any)[styleId]) {
                const styleName = (stylesMap as any)[styleId].name;
                const cleanStyleName = styleName.split('/').pop().trim();
                const matchedMat = MATERIALS.find(m => m.toLowerCase() === cleanStyleName.toLowerCase() || cleanStyleName.toLowerCase().includes(m.toLowerCase()));
                suggestedMaterial = matchedMat || cleanStyleName;
            }
        }

        if (isValidType && n.id !== node.id && hasBoundingBox) {
            layers.push({ 
                id: n.id, 
                name: n.name, 
                type: n.type, 
                bbox: n.absoluteBoundingBox, 
                depth,
                isLocked: isExplicitlyLocked, 
                isEffectivelyLocked: isEffectivelyLocked, 
                isEffectivelyVisible: isEffectivelyVisible,
                isCalculating: false,
                ancestors: ancestorIds,
                isGroup: isGroupLike,
                isExpanded: true,
                suggestedMaterial,
                geometry: n.fillGeometry || n.strokeGeometry
            });
        }
        
        if (n.children) {
            const nextDepth = (isValidType && n.id !== node.id && hasBoundingBox) ? depth + 1 : depth;
            n.children.forEach((child: any) => traverse(child, nextDepth, currentAncestors, isEffectivelyLocked, isEffectivelyVisible));
        }
    }
    
    if (node.children) {
        node.children.forEach((child: any) => traverse(child, 0, [], false, true));
    }

    setFigmaLayers(layers);
  }, []);

  // --- Main Actions ---
  const loadFigmaFrame = async () => {
    if (!figmaPat.trim() || !figmaUrl.trim()) return;

    localStorage.setItem('figmaPat', figmaPat);
    setLoading(true);
    setLoadingStatus('Connecting to Figma API...');

    try {
        const url = new URL(figmaUrl);
        const pathParts = url.pathname.split('/');
        
        let fileKey = null;
        const typeIndex = pathParts.findIndex(p => p === 'design' || p === 'file');
        if (typeIndex !== -1 && pathParts.length > typeIndex + 1) {
            fileKey = pathParts[typeIndex + 1];
        } else {
            throw new Error("Could not find file key in URL.");
        }

        let nodeId = url.searchParams.get('node-id');
        if (!nodeId) throw new Error("Select a specific frame in Figma first.");
        
        const figmaNodeId = nodeId.replace('-', ':');

        const nodeRes = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${figmaNodeId}`, {
            headers: { 'X-Figma-Token': figmaPat }
        });
        
        if (!nodeRes.ok) throw new Error(`Figma Node API Error: ${nodeRes.status}`);
        const nodeData = await nodeRes.json();
        const mainNode = nodeData.nodes[figmaNodeId].document;
        const frameBBox = mainNode.absoluteBoundingBox;

        setLoadingStatus('Rendering design...');
        const imageRes = await fetch(`https://api.figma.com/v1/images/${fileKey}?ids=${figmaNodeId}&format=png&scale=1`, {
            headers: { 'X-Figma-Token': figmaPat }
        });

        if (!imageRes.ok) throw new Error("Failed to render frame image.");
        const data = await imageRes.json();
        const imageUrl = data.images[figmaNodeId];

        imgRef.current.crossOrigin = "anonymous";
        imgRef.current.onerror = () => {
            alert("Failed to load Figma frame image. This may be due to an invalid token, Restricted URL, or network issues.");
            setLoading(false);
        };
        imgRef.current.onload = () => {
            setShapes([]);
            setPanOffset({ x: 0, y: 0 });
            setFigmaContext({ fileKey, pat: figmaPat, frameBBox });
            parseFigmaLayers(mainNode, frameBBox, nodeData.nodes[figmaNodeId].styles || {});
            setIsLoaded(true);
            setLoading(false);
        };
        imgRef.current.src = imageUrl;

    } catch (e: any) {
        alert(e.message);
        setLoading(false);
    }
  };

  const calculateFigmaLayer = async (layer: FigmaLayer, mode: 'area' | 'length', material?: string) => {
    if (!figmaContext) return;
    
    setFigmaLayers(prev => prev.map(l => l.id === layer.id ? { ...l, isCalculating: true } : l));

    try {
        const res = await fetch(`https://api.figma.com/v1/images/${figmaContext.fileKey}?ids=${layer.id}&format=png&scale=1`, {
            headers: { 'X-Figma-Token': figmaContext.pat }
        });
        const data = await res.json();
        const imageUrl = data.images[layer.id];

        if (!imageUrl) throw new Error("Could not export layer.");

        const layerImg = new Image();
        layerImg.crossOrigin = "anonymous";
        
        await new Promise((resolve, reject) => {
            layerImg.onload = resolve;
            layerImg.onerror = reject;
            layerImg.src = imageUrl;
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layerImg.width;
        tempCanvas.height = layerImg.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error("Canvas failure");
        tempCtx.drawImage(layerImg, 0, 0);
        
        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        let areaPixels = 0;
        let boundaryPixels = 0;
        const width = tempCanvas.width;
        const height = tempCanvas.height;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4 + 3;
            const alpha = imgData[idx];
            if (alpha > 127) {
              areaPixels += (alpha / 255);
              
              // Check neighbors for boundary (perimeter)
              let isBoundary = false;
              if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                isBoundary = true;
              } else {
                const neighbors = [
                  ((y - 1) * width + x) * 4 + 3,
                  ((y + 1) * width + x) * 4 + 3,
                  (y * width + (x - 1)) * 4 + 3,
                  (y * width + (x + 1)) * 4 + 3
                ];
                if (neighbors.some(nIdx => imgData[nIdx] < 127)) {
                  isBoundary = true;
                }
              }
              if (isBoundary) boundaryPixels++;
            }
          }
        }

        const newShape: Shape = {
            name: layer.name,
            areaPixels,
            areaSqFt: areaPixels / (pixelsPerFoot * pixelsPerFoot),
            perimeterPixels: boundaryPixels,
            perimeterFt: (mode === 'length')
              ? (layer.geometry && layer.geometry.length > 0) 
                ? calculateGeometryLength(layer.geometry, true) / pixelsPerFoot 
                : (boundaryPixels / 2.0) / pixelsPerFoot // Using centerline approximation for thick rasterized lines
              : boundaryPixels / pixelsPerFoot,
            color: COLORS[colorIndexRef.current % COLORS.length],
            image: layerImg,
            x: layer.bbox.x - figmaContext.frameBBox.x,
            y: layer.bbox.y - figmaContext.frameBBox.y,
            figmaId: layer.id,
            figmaType: layer.type,
            material: material || 'Unassigned',
            measureMode: mode
        };
        
        colorIndexRef.current++;
        setShapes(prev => [...prev, newShape]);
        setFigmaLayers(prev => prev.map(l => l.id === layer.id ? { ...l, isCalculating: false } : l));

    } catch (e: any) {
        alert("Error: " + e.message);
        setFigmaLayers(prev => prev.map(l => l.id === layer.id ? { ...l, isCalculating: false } : l));
    }
  };

  const copyAsCSV = () => {
    if (shapes.length === 0) return;
    const header = "name,type,value\n";
    const rows = shapes.map(s => {
      const value = s.measureMode === 'area' ? s.areaSqFt : (s.perimeterFt || 0);
      return `"${s.name}",number,${value.toFixed(2)}`;
    }).join('\n');
    
    navigator.clipboard.writeText(header + rows);
    setSyncStatus({ message: 'Metrics copied to clipboard as CSV!', type: 'success' });
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (isDrawingMode) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      setCurrentPoints(prev => [...prev, { x, y }]);
    } else {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning && lastMousePos) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setLastMousePos(null);
  };

  const finishCustomShape = (mode: 'area' | 'length' = 'area') => {
    if (currentPoints.length < 3) return;

    const areaPixels = calculatePolygonArea(currentPoints);
    const perimeterPixels = calculatePathLength(currentPoints, mode === 'area');
    const newShape: Shape = {
        name: customShapeName || `Custom ${mode === 'area' ? 'Area' : 'Length'} ${shapes.filter(s => !s.figmaId).length + 1}`,
        points: [...currentPoints],
        areaPixels,
        areaSqFt: areaPixels / (pixelsPerFoot * pixelsPerFoot),
        perimeterPixels,
        perimeterFt: perimeterPixels / pixelsPerFoot,
        color: COLORS[colorIndexRef.current % COLORS.length],
        customId: Date.now().toString(),
        material: 'Unassigned',
        measureMode: mode
    };

    colorIndexRef.current++;
    setShapes(prev => [...prev, newShape]);
    setIsDrawingMode(false);
    setCurrentPoints([]);
    setCustomShapeName('');
  };

  // --- Derived Data ---
  const filteredVisibleLayers = useMemo(() => {
    const hasVisibleDescendants: Record<string, boolean> = {};
    figmaLayers.forEach(l => {
      if (l.isEffectivelyVisible && (!hideLocked || !l.isEffectivelyLocked)) {
        l.ancestors.forEach(id => { hasVisibleDescendants[id] = true; });
      }
    });

    const collapsedIds = new Set(figmaLayers.filter(l => l.isGroup && !l.isExpanded).map(l => l.id));

    return figmaLayers.filter(l => {
        if (!l.isEffectivelyVisible) return false;
        if (hideLocked && l.isEffectivelyLocked) return false;
        for (const ancId of l.ancestors) {
          if (collapsedIds.has(ancId)) return false;
        }
        return true;
    }).map(l => ({ ...l, hasVisibleChildren: !!hasVisibleDescendants[l.id] }));
  }, [figmaLayers, hideLocked]);

  const summary = useMemo(() => {
    const areaTotals: Record<string, number> = {};
    const perimeterTotals: Record<string, number> = {};
    
    shapes.forEach(s => {
      const mat = s.material || 'Unassigned';
      if (s.measureMode === 'area') {
        areaTotals[mat] = (areaTotals[mat] || 0) + s.areaSqFt;
      } else if (s.measureMode === 'length' && s.perimeterFt) {
        perimeterTotals[mat] = (perimeterTotals[mat] || 0) + s.perimeterFt;
      }
    });

    const counts: Record<string, number> = {};
    figmaLayers.forEach(l => {
      if ((l.type === 'INSTANCE' || l.type === 'COMPONENT') && l.isEffectivelyVisible) {
        counts[l.name] = (counts[l.name] || 0) + 1;
      }
    });

    return { areas: areaTotals, perimeters: perimeterTotals, objects: counts };
  }, [shapes, figmaLayers]);

  // --- Renderers ---
  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] text-slate-800 font-sans selection:bg-blue-100 overflow-hidden">
      {/* Header Navigation */}
      <nav className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-slate-400 font-semibold tracking-tight">Pixel Area Calculator</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-bold">{isLoaded ? 'Project Workspace' : 'Setup'}</span>
          </div>
        </div>
        
        {syncStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 ${
              syncStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
              syncStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
              'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            {syncStatus.type === 'success' && <Check className="w-3.5 h-3.5" />}
            {syncStatus.message.includes('[click here to enable it]') ? (
              <span>
                {syncStatus.message.split('[')[0]}
                <a 
                  href="https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=472487374153" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-red-900 transition-colors"
                >
                  click here to enable it
                </a>
                {syncStatus.message.split(']')[1].split(')')[1]}
              </span>
            ) : (
              syncStatus.message
            )}
          </motion.div>
        )}

        <div className="flex items-center gap-3">
          {isLoaded && (
            <div className="flex items-center gap-2 mr-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Scale:</span>
               <div className="flex items-center gap-1">
                 <input 
                   type="number" 
                   value={pixelsPerFoot}
                   onChange={e => setPixelsPerFoot(Number(e.target.value))}
                   className="w-10 bg-transparent text-[11px] font-mono font-bold text-slate-700 outline-none focus:ring-0 text-center"
                 />
                 <span className="text-[10px] font-bold text-slate-400 uppercase">px / ft</span>
               </div>
            </div>
          )}
          {isLoaded && (
            <button 
              onClick={() => { setIsLoaded(false); setShapes([]); setFigmaLayers([]); }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-md transition shadow-sm"
            >
              Change Design
            </button>
          )}
          <button className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm shadow-blue-500/20 transition-all active:scale-95">
            Export Report
          </button>
        </div>
      </nav>

      <main className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden">
        
        {/* Left Column: Preview & Status (25%) */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-4 min-h-0">
          <main className="flex-1 bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden relative group/stage">
            <div className="absolute top-0 inset-x-0 h-10 bg-slate-800/50 backdrop-blur-md flex items-center px-4 border-b border-slate-700/50 justify-between z-10 shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.2)]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.2)]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.2)]"></div>
              </div>
              <div className="px-3 py-1 bg-slate-900/50 border border-slate-700/50 rounded text-[10px] text-slate-400 font-mono flex items-center gap-2">
                <Search className="w-2.5 h-2.5" />
                {isLoaded ? 'figma.com/design/viewport' : 'connect.figma.api'}
              </div>
              <div className="w-10"></div>
            </div>

            <div id="canvas-container" className="w-full h-full pt-10 overflow-auto relative custom-scrollbar-dark grid place-items-center">
               {!isLoaded ? (
                 <div className="w-full h-full flex items-center justify-center p-8 bg-slate-900">
                    {loading ? (
                      <div className="text-center group overflow-hidden">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }} 
                          animate={{ opacity: 1, scale: 1 }}
                          className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 relative overflow-hidden"
                        >
                           <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                           <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-transparent animate-pulse" />
                        </motion.div>
                        <h3 className="font-black text-slate-200 uppercase tracking-widest text-sm">{loadingStatus}</h3>
                        <p className="text-[11px] font-mono text-slate-500 mt-2 italic">Syncing Figma vectors to pixel grid...</p>
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                           <MapIcon className="w-32 h-32 rotate-12" />
                        </div>
                        <div className="w-12 h-12 bg-blue-600 rounded-xl mb-6 flex items-center justify-center shadow-lg shadow-blue-600/20">
                          <ExternalLink className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Connect Frame</h2>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">Import a Figma frame to start calculating exact material surface areas.</p>
                        
                        <div className="space-y-4 relative z-10">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Personal Access Token</label>
                            <input 
                              type="password" 
                              value={figmaPat}
                              onChange={(e) => setFigmaPat(e.target.value)}
                              placeholder="figd_..."
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition outline-none font-mono text-xs" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Figma Design URL</label>
                            <input 
                              type="text" 
                              value={figmaUrl}
                              onChange={(e) => setFigmaUrl(e.target.value)}
                              placeholder="https://figma.com/design/..."
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition outline-none text-xs" 
                            />
                          </div>
                          <button 
                            onClick={loadFigmaFrame}
                            disabled={!figmaPat || !figmaUrl}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] mt-2 group"
                          >
                            <span className="flex items-center justify-center gap-2">
                              Launch Framework
                              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                 </div>
               ) : (
                 <div 
                   className={`p-12 transition-transform duration-200 origin-center ${isDrawingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                   style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
                 >
                    <canvas 
                      ref={canvasRef}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      className="shadow-[0_40px_100px_rgba(0,0,0,0.4)] bg-white ring-1 ring-white/10"
                      style={{ 
                        width: imgRef.current.width * zoomLevel, 
                        height: imgRef.current.height * zoomLevel,
                        imageRendering: 'crisp-edges'
                      }}
                    />
                 </div>
               )}

               {/* Stage Controls Overlay */}
               {isLoaded && (
                 <>
                   <div className="absolute bottom-6 right-6 flex items-center gap-3">
                     <button 
                       onClick={resetView}
                       className="px-3 py-2 bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/50 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-700 transition-all active:scale-95 flex items-center gap-2"
                     >
                       <RefreshCw className="w-3 h-3" /> Reset View
                     </button>
                      <div className="flex bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/50 p-1">
                        <button onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><Minus className="w-4 h-4" /></button>
                        <span className="px-3 flex items-center font-mono font-bold text-[10px] text-slate-300 tabular-nums min-w-[50px] justify-center tracking-tighter">{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(z => Math.min(5, z + 0.25))} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><Plus className="w-4 h-4" /></button>
                      </div>
                   </div>
                   
                   <div className="absolute bottom-6 left-6 flex items-center gap-2">
                      <button 
                        onClick={() => setIsDrawingMode(!isDrawingMode)}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl backdrop-blur-md transition-all flex items-center gap-2 border ${isDrawingMode ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-800/80 text-slate-300 border-slate-700/50 hover:bg-slate-700'}`}
                      >
                         <Scissors className="w-3 h-3" />
                         {isDrawingMode ? 'Cancel Plotting' : 'Plot Custom Area'}
                      </button>
                   </div>
                 </>
               )}
            </div>
          </main>

          {/* Status Bar / Draw Panel */}
          <div className="h-40 bg-white rounded-xl border border-slate-200 p-5 shadow-sm overflow-hidden flex flex-col relative">
            {isDrawingMode ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drawing In Progress</span>
                </div>
                <div className="flex items-center gap-4 flex-grow">
                   <div className="flex-1 space-y-3">
                      <input 
                        type="text" 
                        placeholder="Area Identifier (e.g. Backyard Lawn)" 
                        value={customShapeName}
                        onChange={e => setCustomShapeName(e.target.value)}
                        className="w-full px-0 py-1 bg-transparent border-b-2 border-slate-100 focus:border-blue-500 text-lg font-bold outline-none transition-colors placeholder:text-slate-300"
                      />
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">Points Plotted</span>
                           <span className="text-xl font-mono font-black tabular-nums tracking-tighter">{currentPoints.length}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium leading-tight max-w-[200px]">Click stage to plot points. Double-click or click finish to close the shape.</p>
                      </div>
                   </div>
                   <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex gap-1">
                        <button 
                          onClick={() => finishCustomShape('area')}
                          disabled={currentPoints.length < 3}
                          className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-30 transition-all hover:bg-blue-700 active:scale-95 flex items-center gap-2"
                        >
                          <Square className="w-3 h-3" /> Area
                        </button>
                        <button 
                          onClick={() => finishCustomShape('length')}
                          disabled={currentPoints.length < 2}
                          className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 disabled:opacity-30 transition-all hover:bg-emerald-700 active:scale-95 flex items-center gap-2"
                        >
                          <Ruler className="w-3 h-3" /> Length
                        </button>
                      </div>
                      <button 
                        onClick={() => setCurrentPoints(p => p.slice(0, -1))}
                        disabled={currentPoints.length === 0}
                        className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-30"
                      >
                        Undo Point
                      </button>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Infrastructure Feed</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-300">CALC_ENGINE v1.0.4</div>
                </div>
                <div className="font-mono text-[11px] space-y-1.5 text-slate-600 custom-scrollbar-minimal overflow-y-auto pr-2">
                  <div className="text-slate-300 flex gap-2">
                    <span className="text-slate-200 font-bold opacity-30">14:10</span> 
                    <span>Sync ready. Waiting for design input...</span>
                  </div>
                  {shapes.length > 0 && (
                    <div className="text-blue-600 flex gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                      <span className="text-blue-400 font-bold opacity-30">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> 
                      <span className="font-bold">METRIC_SYNC:</span> 
                      <span>Recorded {shapes[shapes.length-1].name} • {shapes[shapes.length-1].areaSqFt.toFixed(2)} SQFT</span>
                    </div>
                  )}
                  {loading && (
                    <div className="text-amber-600 flex gap-2 animate-pulse">
                      <span className="text-amber-400 font-bold opacity-30">PROG</span> 
                      <span className="font-bold">ENGINE:</span> 
                      <span>Parsing Figma vectors...</span>
                    </div>
                  )}
                  <div className="text-slate-300 flex gap-2">
                    {isLoaded ? (
                      <>
                         <span className="text-slate-200 font-bold opacity-30">AUTH</span> 
                         <span className="text-emerald-500 font-bold">ACTIVE</span>
                         <span>Connection established with token: figd_*******</span>
                      </>
                    ) : (
                      <span className="animate-pulse">_</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle Column: Layers Explorer (50%) */}
        <section className="col-span-12 md:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Layers Explorer</h3>
            <div className="flex items-center gap-2">
               <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 cursor-pointer select-none">
                 <input 
                  type="checkbox" 
                  checked={hideLocked} 
                  onChange={e => setHideLocked(e.target.checked)}
                  className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-0" 
                 />
                 HIDE LOCKED
               </label>
            </div>
          </div>

          {!isLoaded ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center opacity-40">
              <Layers className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-[10px] font-bold uppercase text-slate-400">No Design Connected</p>
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto px-2 py-3 space-y-0.5 custom-scrollbar">
              {filteredVisibleLayers.map(layer => {
                const existingShape = shapes.find(s => s.figmaId === layer.id);
                return (
                    <div 
                      key={layer.id} 
                      className={`group flex items-start py-2.5 px-4 rounded-xl transition-all duration-300 ${existingShape ? 'bg-white shadow-md ring-1 ring-blue-200' : 'hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100'}`}
                    >
                      {existingShape && (
                        <div className="mt-1.5 -ml-1 mr-3 w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(37,99,235,0.4)]" style={{ backgroundColor: existingShape.color.replace('0.4', '1.0') }} />
                      )}
                      
                      <div className="flex-1 flex flex-wrap items-start justify-between gap-y-2 gap-x-3 min-w-0">
                        <div className="flex items-start gap-2 flex-1 min-w-[120px]" style={{ paddingLeft: `${layer.depth * 12}px` }}>
                          <div className="flex-shrink-0 w-4 flex justify-center mt-0.5">
                            {layer.isGroup && layer.hasVisibleChildren ? (
                               <button 
                                onClick={() => setFigmaLayers(prev => prev.map(l => l.id === layer.id ? { ...l, isExpanded: !l.isExpanded } : l))}
                                className="text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-100 rounded-md transition-colors"
                               >
                                {layer.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                               </button>
                            ) : null}
                          </div>
                          {layer.isLocked && <Lock className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" />}
                          <span className={`text-[13px] tracking-tight leading-snug break-words ${existingShape ? 'text-blue-900 font-black' : 'text-slate-700 font-bold'}`}>
                            {layer.name}
                          </span>
                        </div>
  
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
                          {existingShape ? (
                          <>
                            <div className="flex flex-col items-end gap-0.5">
                              {existingShape.measureMode === 'area' ? (
                                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md leading-none">
                                  {existingShape.areaSqFt.toFixed(1)} <span className="opacity-60 text-[8px] uppercase">sqft</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md leading-none">
                                  {existingShape.perimeterFt?.toFixed(1)} <span className="opacity-60 text-[8px] uppercase">ft</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => { setSelectedShapeForMaterial(existingShape); setShowMaterialSidesheet(true); }}
                                className="text-[10px] font-bold px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-100 transition whitespace-nowrap"
                              >
                                {existingShape.material || 'Set'}
                              </button>
                              <button 
                                  onClick={() => setShapes(prev => prev.filter(s => s.figmaId !== layer.id))} 
                                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                  <X className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        ) : (
                          layer.isCalculating ? (
                            <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => calculateFigmaLayer(layer, 'area', layer.suggestedMaterial || undefined)} 
                                title="Measure Area"
                                className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white transition-all"
                              >
                                <Square className="w-2.5 h-2.5" />
                              </button>
                              <button 
                                onClick={() => calculateFigmaLayer(layer, 'length', layer.suggestedMaterial || undefined)} 
                                title="Measure Length/Perimeter"
                                className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 text-slate-400 hover:bg-emerald-600 hover:text-white transition-all"
                              >
                                <Ruler className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Custom Shapes in List */}
              {shapes.filter(s => !s.figmaId).map(shape => (
                  <div key={shape.customId} className="group flex items-start py-2.5 px-4 rounded-xl bg-white shadow-sm border border-orange-100 transition-all duration-300 hover:shadow-md">
                    <div className="mt-1.5 -ml-1 mr-3 w-1.5 h-1.5 rounded-full flex-shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.4)]" style={{ backgroundColor: shape.color.replace('0.4', '1.0') }} />
                    
                    <div className="flex-1 flex flex-wrap items-start justify-between gap-y-2 gap-x-3 min-w-0">
                      <div className="flex items-start gap-3 flex-1 min-w-[120px]">
                        <div className="w-4 flex-shrink-0" />
                        <span className="text-[13px] font-black text-orange-700 tracking-tight leading-snug break-words">{shape.name}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
                          <div className="flex flex-col items-end gap-0.5">
                          {shape.measureMode === 'area' ? (
                              <span className="text-[10px] font-mono font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-md leading-none">
                              {shape.areaSqFt.toFixed(1)} <span className="opacity-60 text-[8px] uppercase">sqft</span>
                              </span>
                          ) : (
                              <span className="text-[10px] font-mono font-bold text-orange-600 bg-white border border-orange-200 px-1.5 py-0.5 rounded-md leading-none">
                              {shape.perimeterFt?.toFixed(1)} <span className="opacity-60 text-[8px] uppercase">ft</span>
                              </span>
                          )}
                          </div>
                          <div className="flex items-center gap-1">
                              <button 
                                  onClick={() => { setSelectedShapeForMaterial(shape); setShowMaterialSidesheet(true); }}
                                  className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-orange-100 rounded text-orange-600 hover:bg-orange-100 transition whitespace-nowrap"
                              >
                                  {shape.material || 'Set'}
                              </button>
                              <button onClick={() => setShapes(prev => prev.filter(s => s.customId !== shape.customId))} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                          </div>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Measurement Inspector (25%) */}
        <aside className="col-span-12 md:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 shrink-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Measurement Inspector</h3>
          </div>
          
          {!isLoaded ? (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center opacity-40">
              <FileBarChart2 className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-[10px] font-bold uppercase text-slate-400">No Metrics Found</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {Object.keys(summary.areas).length > 0 && (
                <div className="mb-10">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Material Surface Areas</label>
                  <div className="space-y-2">
                    {(Object.entries(summary.areas) as [string, number][]).sort((a,b) => b[1] - a[1]).map(([mat, area]) => (
                      <div key={mat} className="p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-default relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1 bg-blue-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-bold text-slate-600 truncate pr-2 group-hover:text-blue-700">{mat}</span>
                           <span className="text-sm font-mono font-black text-slate-900 group-hover:text-blue-900">
                             {(area as number).toFixed(1)}
                             <span className="text-[10px] ml-1 font-bold opacity-40 uppercase tracking-tighter">sq ft</span>
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(summary.perimeters).length > 0 && (
                <div className="mb-10">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Linear Footages (Edging/Walls)</label>
                  <div className="space-y-2">
                    {(Object.entries(summary.perimeters) as [string, number][]).sort((a,b) => b[1] - a[1]).map(([mat, perimeter]) => (
                      <div key={mat} className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl group hover:bg-emerald-100 transition-all cursor-default relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
                        <div className="flex items-center justify-between">
                           <span className="text-xs font-bold text-emerald-800 truncate pr-2">{mat}</span>
                           <span className="text-sm font-mono font-black text-emerald-900">
                             {(perimeter as number).toFixed(1)}
                             <span className="text-[10px] ml-1 font-bold opacity-40 uppercase tracking-tighter">linear ft</span>
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(summary.objects).length > 0 && (
                <div className="mb-0">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Object Inventory</label>
                  <div className="space-y-1.5">
                    {(Object.entries(summary.objects) as [string, number][]).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg group transition-colors">
                        <div className="flex items-center gap-2 truncate">
                           <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-blue-400 transition-colors" />
                           <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 truncate">{name}</span>
                        </div>
                        <span className="text-[11px] font-mono font-black text-slate-400 group-hover:text-blue-600">{count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-slate-100">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Export to Google Sheets</label>
                <div className="space-y-4">
                  {!googleToken ? (
                    <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                       <p className="text-[11px] text-slate-500 mb-4 px-4 leading-relaxed">Sign in with Google to export calculation metrics directly to your spreadsheets.</p>
                       <button 
                        onClick={handleGoogleLogin}
                        className="bg-white border border-slate-200 px-4 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 mx-auto group"
                       >
                         <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                         </svg>
                         <span className="text-[11px] font-bold text-slate-700">Sign in with Google</span>
                       </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                           <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-wide">Destination Sheet</h4>
                           <div className="flex items-center gap-1.5 bg-blue-100 px-2 py-0.5 rounded text-[9px] font-bold text-blue-700">
                              <Check className="w-2.5 h-2.5" /> AUTHENTICATED
                           </div>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Paste Spreadsheet ID or URL" 
                          value={googleSheetId}
                          onChange={e => saveSheetId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                        />
                        <p className="text-[9px] text-blue-600/60 mt-2 italic leading-tight">We'll append new calculation rows to the end of this sheet.</p>
                      </div>

                      <button 
                        onClick={exportToSheets}
                        disabled={isExporting || (Object.keys(summary.areas).length === 0 && Object.keys(summary.perimeters).length === 0 && Object.keys(summary.objects).length === 0)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group"
                      >
                        {isExporting ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileBarChart2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        )}
                        {isExporting ? 'Processing Export...' : 'Sync to Google Sheets'}
                      </button>
                      
                      <button 
                        onClick={() => { setGoogleToken(null); auth.signOut(); }}
                        className="w-full py-2 px-4 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                      >
                        Sign out of Google
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {Object.keys(summary.areas).length === 0 && Object.keys(summary.perimeters).length === 0 && Object.keys(summary.objects).length === 0 && (
                <div className="py-10 text-center">
                   <p className="text-xs text-slate-300 italic">Select layers or plot shapes to see summary analysis.</p>
                </div>
              )}


            </div>
          )}
        </aside>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-6 bg-blue-600 text-white flex items-center px-4 justify-between text-[10px] font-bold tracking-widest uppercase shrink-0 z-10 select-none">
        <div className="flex gap-6">
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">Status:</span> 
            <span className="flex items-center gap-1">
               READY <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)]"></div>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-60">Engine:</span> WEB_CALC_PIXEL_SYNC
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-60">Frame:</span> {isLoaded ? 'Synchronized' : 'Standalone'}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="opacity-60">Memory:</span> ~14.2 MB
          </div>
          <div className="flex items-center gap-2 font-mono">
            {new Date().toISOString().split('T')[1].slice(0, 8)} UTC
          </div>
        </div>
      </footer>

      {/* Material Sidesheet */}
      <AnimatePresence>
        {showMaterialSidesheet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => { setShowMaterialSidesheet(false); setSelectedShapeForMaterial(null); }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div>
                    <h3 className="font-bold text-gray-900">Assign Material</h3>
                    <p className="text-xs text-gray-500 font-medium">Select a material for "{selectedShapeForMaterial?.name}"</p>
                 </div>
                 <button onClick={() => { setShowMaterialSidesheet(false); setSelectedShapeForMaterial(null); }} className="p-2 hover:bg-white rounded-full transition shadow-sm border border-transparent hover:border-gray-200">
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="p-6 bg-white border-b border-gray-100">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search library..." 
                    value={materialSearchQuery}
                    onChange={e => setMaterialSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-100 border border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm" 
                  />
                </div>
              </div>

              <div className="flex-grow overflow-y-auto p-4 space-y-1">
                {MATERIALS.filter(m => m.toLowerCase().includes(materialSearchQuery.toLowerCase())).map(mat => (
                  <button 
                    key={mat}
                    onClick={() => {
                      if (selectedShapeForMaterial) {
                        setShapes(prev => prev.map(s => {
                          if (s.figmaId && s.figmaId === selectedShapeForMaterial.figmaId) return { ...s, material: mat };
                          if (s.customId && s.customId === selectedShapeForMaterial.customId) return { ...s, material: mat };
                          return s;
                        }));
                      }
                      setShowMaterialSidesheet(false);
                      setSelectedShapeForMaterial(null);
                    }}
                    className="w-full text-left px-5 py-3.5 rounded-xl hover:bg-blue-50 hover:text-blue-700 transition-all group flex justify-between items-center"
                  >
                    <span className="text-sm font-bold">{mat}</span>
                    <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

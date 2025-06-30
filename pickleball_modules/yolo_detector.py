#!/usr/bin/env python3
"""
YOLODetector Module
===================

This module handles YOLO model loading, inference, and detection processing
for pickleball video analysis. It provides a clean interface for object
detection with configurable parameters and comprehensive logging.

Author: PickleballAI Team
Date: 2024
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from pathlib import Path
import json
import time
from enum import Enum

class DetectionClass(Enum):
    """Enumeration of detection classes for pickleball analysis"""
    PERSON = "person"
    SPORTS_BALL = "sports ball"
    TENNIS_RACKET = "tennis racket"  # Can be used for paddle detection
    NET = "net"
    COURT_LINE = "court_line"
    UNKNOWN = "unknown"

@dataclass
class Detection:
    """Data class for individual detections"""
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]
    center_point: List[float]  # [x, y]
    frame_id: int
    timestamp: float
    detection_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert detection to dictionary format"""
        return {
            "class": self.class_name,
            "confidence": self.confidence,
            "bbox": self.bbox,
            "center_point": self.center_point,
            "frame_id": self.frame_id,
            "timestamp": self.timestamp,
            "detection_id": self.detection_id
        }

class YOLODetector:
    """
    YOLO-based object detector for pickleball video analysis.
    
    This class handles:
    - Model loading and initialization
    - Frame preprocessing
    - Object detection inference
    - Post-processing and filtering
    - Detection quality assessment
    """
    
    def __init__(self, 
                 model_path: str = "yolov8n.pt",
                 confidence_threshold: float = 0.5,
                 nms_threshold: float = 0.4,
                 device: str = "cpu",
                 input_size: Tuple[int, int] = (640, 640)):
        """
        Initialize YOLO detector.
        
        Args:
            model_path: Path to YOLO model file
            confidence_threshold: Minimum confidence for detections
            nms_threshold: Non-maximum suppression threshold
            device: Device to run inference on ('cpu', 'cuda', etc.)
            input_size: Input size for the model (width, height)
        """
        self.model_path = model_path
        self.confidence_threshold = confidence_threshold
        self.nms_threshold = nms_threshold
        self.device = device
        self.input_size = input_size
        
        # Initialize model
        self.model = None
        self.class_names = []
        self.is_initialized = False
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        
        # Performance tracking
        self.inference_times = []
        self.detection_counts = []
        
        # Initialize the model
        self._load_model()
    
    def _load_model(self) -> bool:
        """
        Load YOLO model from file.
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        try:
            # Try to load YOLO model using OpenCV DNN
            self.model = cv2.dnn.readNet(self.model_path)
            
            # Set preferred backend and target
            self.model.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            self.model.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
            
            # Load class names (if available)
            self._load_class_names()
            
            self.is_initialized = True
            self.logger.info(f"YOLO model loaded successfully from {self.model_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to load YOLO model: {str(e)}")
            self.is_initialized = False
            return False
    
    def _load_class_names(self):
        """Load class names for the model"""
        # Default COCO classes (YOLO v8 standard)
        self.class_names = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
            'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
            'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
            'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
            'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
            'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
            'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
            'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
            'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ]
        
        # Try to load custom class names if available
        class_file = self.model_path.replace('.pt', '.names')
        if Path(class_file).exists():
            try:
                with open(class_file, 'r') as f:
                    self.class_names = [line.strip() for line in f.readlines()]
                self.logger.info(f"Loaded custom class names from {class_file}")
            except Exception as e:
                self.logger.warning(f"Failed to load custom class names: {str(e)}")
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Preprocess frame for YOLO inference.
        
        Args:
            frame: Input frame as numpy array
            
        Returns:
            np.ndarray: Preprocessed frame
        """
        # Resize frame to model input size
        resized = cv2.resize(frame, self.input_size)
        
        # Convert to blob format
        blob = cv2.dnn.blobFromImage(
            resized, 
            1/255.0,  # Scale factor
            self.input_size,  # Size
            swapRB=True,  # Swap Red and Blue channels
            crop=False
        )
        
        return blob
    
    def detect_objects(self, 
                      frame: np.ndarray, 
                      frame_id: int = 0, 
                      timestamp: float = 0.0) -> List[Detection]:
        """
        Detect objects in a single frame.
        
        Args:
            frame: Input frame as numpy array
            frame_id: Frame identifier
            timestamp: Frame timestamp
            
        Returns:
            List[Detection]: List of detected objects
        """
        if not self.is_initialized:
            self.logger.error("YOLO model not initialized")
            return []
        
        start_time = time.time()
        
        try:
            # Preprocess frame
            blob = self.preprocess_frame(frame)
            
            # Run inference
            self.model.setInput(blob)
            outputs = self.model.forward()
            
            # Process detections
            detections = self._process_outputs(outputs, frame.shape, frame_id, timestamp)
            
            # Track performance
            inference_time = time.time() - start_time
            self.inference_times.append(inference_time)
            self.detection_counts.append(len(detections))
            
            self.logger.debug(f"Frame {frame_id}: {len(detections)} detections in {inference_time:.3f}s")
            
            return detections
            
        except Exception as e:
            self.logger.error(f"Error during detection: {str(e)}")
            return []
    
    def _process_outputs(self, 
                        outputs: List[np.ndarray], 
                        original_shape: Tuple[int, int, int],
                        frame_id: int,
                        timestamp: float) -> List[Detection]:
        """
        Process YOLO model outputs into Detection objects.
        
        Args:
            outputs: Raw model outputs
            original_shape: Original frame shape (height, width, channels)
            frame_id: Frame identifier
            timestamp: Frame timestamp
            
        Returns:
            List[Detection]: Processed detections
        """
        detections = []
        height, width = original_shape[:2]
        
        # Process each detection
        for detection in outputs[0]:
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            
            # Filter by confidence threshold
            if confidence < self.confidence_threshold:
                continue
            
            # Get class name
            class_name = self.class_names[class_id] if class_id < len(self.class_names) else "unknown"
            
            # Get bounding box coordinates
            center_x = detection[0] * width
            center_y = detection[1] * height
            w = detection[2] * width
            h = detection[3] * height
            
            # Convert to [x1, y1, x2, y2] format
            x1 = int(center_x - w / 2)
            y1 = int(center_y - h / 2)
            x2 = int(center_x + w / 2)
            y2 = int(center_y + h / 2)
            
            # Create detection object
            detection_obj = Detection(
                class_name=class_name,
                confidence=float(confidence),
                bbox=[x1, y1, x2, y2],
                center_point=[center_x, center_y],
                frame_id=frame_id,
                timestamp=timestamp
            )
            
            detections.append(detection_obj)
        
        # Apply non-maximum suppression
        detections = self._apply_nms(detections)
        
        return detections
    
    def _apply_nms(self, detections: List[Detection]) -> List[Detection]:
        """
        Apply non-maximum suppression to remove overlapping detections.
        
        Args:
            detections: List of detections
            
        Returns:
            List[Detection]: Filtered detections
        """
        if not detections:
            return []
        
        # Convert to format suitable for NMS
        boxes = np.array([d.bbox for d in detections])
        scores = np.array([d.confidence for d in detections])
        
        # Apply NMS
        indices = cv2.dnn.NMSBoxes(
            boxes.tolist(), 
            scores.tolist(), 
            self.confidence_threshold, 
            self.nms_threshold
        )
        
        # Return filtered detections
        if len(indices) > 0:
            return [detections[i] for i in indices.flatten()]
        else:
            return []
    
    def detect_video_frames(self, 
                           frames: List[np.ndarray], 
                           frame_ids: Optional[List[int]] = None,
                           timestamps: Optional[List[float]] = None) -> List[List[Detection]]:
        """
        Detect objects in multiple frames.
        
        Args:
            frames: List of input frames
            frame_ids: Optional list of frame identifiers
            timestamps: Optional list of frame timestamps
            
        Returns:
            List[List[Detection]]: List of detections for each frame
        """
        if frame_ids is None:
            frame_ids = list(range(len(frames)))
        if timestamps is None:
            timestamps = [i * 0.033 for i in range(len(frames))]  # Assume 30 FPS
        
        all_detections = []
        
        for i, frame in enumerate(frames):
            detections = self.detect_objects(
                frame, 
                frame_ids[i], 
                timestamps[i]
            )
            all_detections.append(detections)
        
        return all_detections
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """
        Get performance statistics.
        
        Returns:
            Dict[str, Any]: Performance statistics
        """
        if not self.inference_times:
            return {
                "average_inference_time": 0.0,
                "total_frames_processed": 0,
                "average_detections_per_frame": 0.0,
                "total_detections": 0
            }
        
        return {
            "average_inference_time": np.mean(self.inference_times),
            "total_frames_processed": len(self.inference_times),
            "average_detections_per_frame": np.mean(self.detection_counts),
            "total_detections": sum(self.detection_counts),
            "min_inference_time": np.min(self.inference_times),
            "max_inference_time": np.max(self.inference_times)
        }
    
    def filter_detections_by_class(self, 
                                  detections: List[Detection], 
                                  target_classes: List[str]) -> List[Detection]:
        """
        Filter detections by class names.
        
        Args:
            detections: List of detections
            target_classes: List of target class names
            
        Returns:
            List[Detection]: Filtered detections
        """
        return [d for d in detections if d.class_name in target_classes]
    
    def assess_detection_quality(self, detections: List[Detection]) -> Dict[str, Any]:
        """
        Assess the quality of detections.
        
        Args:
            detections: List of detections
            
        Returns:
            Dict[str, Any]: Quality assessment metrics
        """
        if not detections:
            return {
                "quality_score": 0.0,
                "average_confidence": 0.0,
                "detection_count": 0,
                "issues": ["no_detections"]
            }
        
        # Calculate quality metrics
        confidences = [d.confidence for d in detections]
        avg_confidence = np.mean(confidences)
        
        # Identify potential issues
        issues = []
        if avg_confidence < 0.6:
            issues.append("low_confidence")
        
        if len(detections) == 0:
            issues.append("no_detections")
        elif len(detections) > 10:
            issues.append("too_many_detections")
        
        # Calculate quality score
        quality_score = avg_confidence
        if issues:
            quality_score *= 0.8  # Penalty for issues
        
        return {
            "quality_score": quality_score,
            "average_confidence": avg_confidence,
            "detection_count": len(detections),
            "issues": issues,
            "confidence_distribution": {
                "high": len([c for c in confidences if c >= 0.8]),
                "medium": len([c for c in confidences if 0.5 <= c < 0.8]),
                "low": len([c for c in confidences if c < 0.5])
            }
        }
    
    def save_detections(self, 
                       detections: List[List[Detection]], 
                       output_path: str):
        """
        Save detections to JSON file.
        
        Args:
            detections: List of detections for each frame
            output_path: Output file path
        """
        try:
            # Convert to serializable format
            data = []
            for frame_detections in detections:
                frame_data = [d.to_dict() for d in frame_detections]
                data.append(frame_data)
            
            with open(output_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            self.logger.info(f"Detections saved to {output_path}")
            
        except Exception as e:
            self.logger.error(f"Failed to save detections: {str(e)}")
    
    def load_detections(self, input_path: str) -> List[List[Detection]]:
        """
        Load detections from JSON file.
        
        Args:
            input_path: Input file path
            
        Returns:
            List[List[Detection]]: Loaded detections
        """
        try:
            with open(input_path, 'r') as f:
                data = json.load(f)
            
            # Convert back to Detection objects
            detections = []
            for frame_data in data:
                frame_detections = []
                for detection_dict in frame_data:
                    detection = Detection(
                        class_name=detection_dict["class"],
                        confidence=detection_dict["confidence"],
                        bbox=detection_dict["bbox"],
                        center_point=detection_dict["center_point"],
                        frame_id=detection_dict["frame_id"],
                        timestamp=detection_dict["timestamp"],
                        detection_id=detection_dict.get("detection_id")
                    )
                    frame_detections.append(detection)
                detections.append(frame_detections)
            
            self.logger.info(f"Detections loaded from {input_path}")
            return detections
            
        except Exception as e:
            self.logger.error(f"Failed to load detections: {str(e)}")
            return []

# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Initialize detector
    detector = YOLODetector(
        model_path="yolov8n.pt",
        confidence_threshold=0.5,
        nms_threshold=0.4
    )
    
    # Test with mock frame
    mock_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    
    # Run detection
    detections = detector.detect_objects(mock_frame, frame_id=0, timestamp=0.0)
    
    print(f"Detected {len(detections)} objects")
    for detection in detections:
        print(f"- {detection.class_name}: {detection.confidence:.2f}")
    
    # Get performance stats
    stats = detector.get_performance_stats()
    print(f"Performance: {stats}") 
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export interface RouteData {
  employeeId: string;
  employeeName: string;
  locations: EmployeeLocation[];
  totalDistance: number;
  totalTime: number;
  startTime: string;
  endTime: string;
  averageSpeed: number;
  stops: number;
}

export interface PDFReportOptions {
  includeRoute: boolean;
  include3DVisualization: boolean;
  includeStatistics: boolean;
  includeTimeline: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export class PDFReportService {
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private static calculateRouteStatistics(locations: EmployeeLocation[]): {
    totalDistance: number;
    totalTime: number;
    averageSpeed: number;
    stops: number;
  } {
    if (locations.length < 2) {
      return {
        totalDistance: 0,
        totalTime: 0,
        averageSpeed: 0,
        stops: 0
      };
    }

    let totalDistance = 0;
    let stops = 0;
    const stopThreshold = 5; // meters
    const timeThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Sort locations by timestamp
    const sortedLocations = [...locations].sort((a, b) => 
      new Date(a.last_updated || a.recorded_at || '').getTime() - 
      new Date(b.last_updated || b.recorded_at || '').getTime()
    );

    for (let i = 1; i < sortedLocations.length; i++) {
      const prev = sortedLocations[i - 1];
      const curr = sortedLocations[i];
      
      const distance = this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      
      totalDistance += distance;

      // Check for stops (minimal movement over time)
      if (distance < stopThreshold) {
        const timeDiff = new Date(curr.last_updated || curr.recorded_at || '').getTime() - 
                        new Date(prev.last_updated || prev.recorded_at || '').getTime();
        if (timeDiff > timeThreshold) {
          stops++;
        }
      }
    }

    const startTime = new Date(sortedLocations[0].last_updated || sortedLocations[0].recorded_at || '');
    const endTime = new Date(sortedLocations[sortedLocations.length - 1].last_updated || sortedLocations[sortedLocations.length - 1].recorded_at || '');
    const totalTime = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
    const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3.6 : 0; // km/h

    return {
      totalDistance,
      totalTime,
      averageSpeed,
      stops
    };
  }

  static async generateEmployeeRouteReport(
    employeeId: string,
    employeeName: string,
    locations: EmployeeLocation[],
    options: PDFReportOptions = {
      includeRoute: true,
      include3DVisualization: false,
      includeStatistics: true,
      includeTimeline: true
    }
  ): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Calculate route statistics
    const stats = this.calculateRouteStatistics(locations);

    // Header with gradient effect
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Add a subtle pattern
    doc.setFillColor(52, 152, 219);
    for (let i = 0; i < pageWidth; i += 10) {
      doc.rect(i, 0, 5, 35, 'F');
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Route Report', margin, 22);
    
    // Add company logo placeholder
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - 40, 5, 30, 25, 'F');
    doc.setTextColor(41, 128, 185);
    doc.setFontSize(8);
    doc.text('LOGO', pageWidth - 25, 18);

    // Employee Info Card
    const infoY = 50;
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, infoY, contentWidth, 25, 'F');
    doc.setDrawColor(220, 221, 222);
    doc.rect(margin, infoY, contentWidth, 25, 'S');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Employee: ${employeeName}`, margin + 5, infoY + 8);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Employee ID: ${employeeId}`, margin + 5, infoY + 16);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, margin + 5, infoY + 22);

    // Statistics Section with Cards
    if (options.includeStatistics) {
      const statsY = 85;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Route Statistics', margin, statsY);

      // Create statistics cards
      const cardWidth = (contentWidth - 10) / 2;
      const cardHeight = 20;
      const cardSpacing = 5;

      // Card 1: Distance and Time
      doc.setFillColor(52, 152, 219);
      doc.rect(margin, statsY + 10, cardWidth, cardHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Distance & Time', margin + 5, statsY + 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${(stats.totalDistance / 1000).toFixed(2)} km`, margin + 5, statsY + 25);
      doc.text(`${Math.floor(stats.totalTime / 3600)}h ${Math.floor((stats.totalTime % 3600) / 60)}m`, margin + 5, statsY + 30);

      // Card 2: Speed and Stops
      doc.setFillColor(46, 204, 113);
      doc.rect(margin + cardWidth + cardSpacing, statsY + 10, cardWidth, cardHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Speed & Stops', margin + cardWidth + cardSpacing + 5, statsY + 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${stats.averageSpeed.toFixed(2)} km/h`, margin + cardWidth + cardSpacing + 5, statsY + 25);
      doc.text(`${stats.stops} stops`, margin + cardWidth + cardSpacing + 5, statsY + 30);

      // Card 3: Location Count
      doc.setFillColor(155, 89, 182);
      doc.rect(margin, statsY + 35, cardWidth, cardHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Location Data', margin + 5, statsY + 43);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${locations.length} points`, margin + 5, statsY + 50);
    }

    // Route Map Section
    if (options.includeRoute && locations.length > 0) {
      const mapY = 160;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Route Visualization', margin, mapY);

      // Create a simple route representation
      const mapWidth = contentWidth;
      const mapHeight = 80;
      const mapStartY = mapY + 10;

      // Draw route path
      if (locations.length > 1) {
        const sortedLocations = [...locations].sort((a, b) => 
          new Date(a.last_updated || a.recorded_at || '').getTime() - 
          new Date(b.last_updated || b.recorded_at || '').getTime()
        );

        // Calculate bounds
        const lats = sortedLocations.map(l => l.latitude);
        const lngs = sortedLocations.map(l => l.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        // Draw route line
        doc.setDrawColor(41, 128, 185);
        doc.setLineWidth(2);
        
        for (let i = 1; i < sortedLocations.length; i++) {
          const prev = sortedLocations[i - 1];
          const curr = sortedLocations[i];
          
          const x1 = margin + ((prev.longitude - minLng) / (maxLng - minLng)) * mapWidth;
          const y1 = mapStartY + ((maxLat - prev.latitude) / (maxLat - minLat)) * mapHeight;
          const x2 = margin + ((curr.longitude - minLng) / (maxLng - minLng)) * mapWidth;
          const y2 = mapStartY + ((maxLat - curr.latitude) / (maxLat - minLat)) * mapHeight;
          
          doc.line(x1, y1, x2, y2);
        }

        // Draw start and end points
        const startLoc = sortedLocations[0];
        const endLoc = sortedLocations[sortedLocations.length - 1];
        
        const startX = margin + ((startLoc.longitude - minLng) / (maxLng - minLng)) * mapWidth;
        const startY = mapStartY + ((maxLat - startLoc.latitude) / (maxLat - minLat)) * mapHeight;
        const endX = margin + ((endLoc.longitude - minLng) / (maxLng - minLng)) * mapWidth;
        const endY = mapStartY + ((maxLat - endLoc.latitude) / (maxLat - minLat)) * mapHeight;

        // Start point (green)
        doc.setFillColor(46, 204, 113);
        doc.circle(startX, startY, 3, 'F');
        
        // End point (red)
        doc.setFillColor(231, 76, 60);
        doc.circle(endX, endY, 3, 'F');

        // Legend
        doc.setFontSize(10);
        doc.setFillColor(46, 204, 113);
        doc.circle(margin, mapStartY + mapHeight + 15, 2, 'F');
        doc.text('Start', margin + 8, mapStartY + mapHeight + 18);
        
        doc.setFillColor(231, 76, 60);
        doc.circle(margin + 30, mapStartY + mapHeight + 15, 2, 'F');
        doc.text('End', margin + 38, mapStartY + mapHeight + 18);
        
        doc.setDrawColor(41, 128, 185);
        doc.setLineWidth(1);
        doc.line(margin + 60, mapStartY + mapHeight + 15, margin + 75, mapStartY + mapHeight + 15);
        doc.text('Route', margin + 80, mapStartY + mapHeight + 18);
      }
    }

    // Timeline Section
    if (options.includeTimeline && locations.length > 0) {
      const timelineY = 280;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Location Timeline', margin, timelineY);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const sortedLocations = [...locations].sort((a, b) => 
        new Date(a.last_updated || a.recorded_at || '').getTime() - 
        new Date(b.last_updated || b.recorded_at || '').getTime()
      );

      let yPos = timelineY + 15;
      sortedLocations.slice(0, 20).forEach((location, index) => { // Limit to 20 entries
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        const timestamp = new Date(location.last_updated || location.recorded_at || '').toLocaleString();
        doc.text(`${index + 1}. ${timestamp}`, margin, yPos);
        doc.text(`   Lat: ${location.latitude.toFixed(6)}, Lng: ${location.longitude.toFixed(6)}`, margin + 10, yPos + 5);
        yPos += 12;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by Task Management System', margin, pageHeight - 10);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin - 20, pageHeight - 10);

    // Download the PDF
    const fileName = `Employee_Route_Report_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  static async generateAllEmployeesReport(
    allEmployeeData: { [employeeId: string]: EmployeeLocation[] },
    options: PDFReportOptions = {
      includeRoute: true,
      include3DVisualization: false,
      includeStatistics: true,
      includeTimeline: false
    }
  ): Promise<void> {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Header
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('All Employees Route Report', margin, 20);

    // Summary Statistics
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, 45);

    const employeeCount = Object.keys(allEmployeeData).length;
    const totalLocations = Object.values(allEmployeeData).reduce((sum, locations) => sum + locations.length, 0);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Employees: ${employeeCount}`, margin, 60);
    doc.text(`Total Location Records: ${totalLocations}`, margin, 70);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, margin, 80);

    // Individual Employee Summaries
    let yPos = 100;
    Object.entries(allEmployeeData).forEach(([employeeId, locations]) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      const stats = this.calculateRouteStatistics(locations);
      const employeeName = locations[0]?.full_name || 'Unknown Employee';

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(employeeName, margin, yPos);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`  Distance: ${(stats.totalDistance / 1000).toFixed(2)} km`, margin, yPos + 8);
      doc.text(`  Time: ${Math.floor(stats.totalTime / 3600)}h ${Math.floor((stats.totalTime % 3600) / 60)}m`, margin, yPos + 16);
      doc.text(`  Locations: ${locations.length}`, margin, yPos + 24);

      yPos += 40;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Generated by Task Management System', margin, doc.internal.pageSize.getHeight() - 10);

    const fileName = `All_Employees_Route_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
}

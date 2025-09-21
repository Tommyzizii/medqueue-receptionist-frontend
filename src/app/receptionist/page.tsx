// ENHANCED RECEPTIONIST DASHBOARD - Multi-Doctor Support
"use client";

import { useState, useEffect } from "react";
import { Clock, User, RefreshCw, UserPlus, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MedqueueAPI from "@/lib/api";

type Status = "Waiting" | "Arrived" | "In consultation" | "Completed" | "No-show" | "Cancelled";

interface Doctor {
  doctorId: string;
  name: string;
  specialization: string;
  experience: string;
  availability: string;
}

interface Patient {
  id: string;
  appointmentId: string;
  name: string;
  status: Status;
  type: 'appointment' | 'walk-in';
  queuePosition: number;
  timeSlot: {
    start: Date;
    end: Date;
  };
  scheduledTime?: Date;
  email?: string;
  patientId?: string;
  doctorId?: string;
  doctorName?: string;
}

const CONSULTATION_DURATION = 30; // minutes

export default function ReceptionistDashboard() {
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeFilter, setActiveFilter] = useState<Status | "all" | "by-doctor">("all");
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>("all");
  const [newWalkInName, setNewWalkInName] = useState("");
  const [selectedWalkInDoctor, setSelectedWalkInDoctor] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadDoctors();
    loadTodaysQueue();
    const interval = setInterval(loadTodaysQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load available doctors
  const loadDoctors = async () => {
    try {
      console.log("🔄 Loading doctors...");
      const response = await MedqueueAPI.getDoctors();
      
      if (Array.isArray(response)) {
        setDoctors(response);
        // Set first doctor as default for walk-ins
        if (response.length > 0 && !selectedWalkInDoctor) {
          setSelectedWalkInDoctor(response[0].doctorId);
        }
        console.log(`✅ Loaded ${response.length} doctors`);
      }
    } catch (error: any) {
      console.error("❌ Error loading doctors:", error);
      setError(`Failed to load doctors: ${error.message}`);
    }
  };

  // Calculate next available time slot for specific doctor
  const getNextAvailableTimeSlot = (doctorId: string, existingPatients: Patient[]): { start: Date; end: Date } => {
    const now = new Date();
    
    // Get all occupied time slots for this specific doctor
    const occupiedSlots = existingPatients
      .filter(p => p.doctorId === doctorId && ['Waiting', 'Arrived', 'In consultation'].includes(p.status))
      .map(p => p.timeSlot)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Start from current time, rounded to nearest 30-minute interval
    let candidateStart = new Date(now);
    const minutes = candidateStart.getMinutes();
    const roundedMinutes = Math.ceil(minutes / CONSULTATION_DURATION) * CONSULTATION_DURATION;
    candidateStart.setMinutes(roundedMinutes, 0, 0);
    
    if (candidateStart <= now) {
      candidateStart = new Date(now);
    }

    // Find first available slot for this doctor
    while (true) {
      const candidateEnd = new Date(candidateStart.getTime() + CONSULTATION_DURATION * 60000);
      
      const hasConflict = occupiedSlots.some(slot => {
        return (candidateStart < slot.end && candidateEnd > slot.start);
      });

      if (!hasConflict) {
        return { start: candidateStart, end: candidateEnd };
      }

      candidateStart = new Date(candidateStart.getTime() + CONSULTATION_DURATION * 60000);
    }
  };

  // Calculate queue positions for active patients by doctor
  const calculateQueuePositions = (patients: Patient[]): Patient[] => {
    // Group patients by doctor
    const patientsByDoctor = patients.reduce((acc, patient) => {
      const doctorId = patient.doctorId || 'DOC001';
      if (!acc[doctorId]) acc[doctorId] = [];
      acc[doctorId].push(patient);
      return acc;
    }, {} as Record<string, Patient[]>);

    const updatedPatients: Patient[] = [];

    // Calculate positions within each doctor's queue
    Object.entries(patientsByDoctor).forEach(([doctorId, doctorPatients]) => {
      const activePatients = doctorPatients
        .filter(p => ['Waiting', 'Arrived', 'In consultation'].includes(p.status))
        .sort((a, b) => a.timeSlot.start.getTime() - b.timeSlot.start.getTime());

      const completedPatients = doctorPatients
        .filter(p => !['Waiting', 'Arrived', 'In consultation'].includes(p.status));

      // Assign queue positions within this doctor's queue
      const updatedActive = activePatients.map((patient, index) => ({
        ...patient,
        queuePosition: index + 1
      }));

      const updatedCompleted = completedPatients.map(patient => ({
        ...patient,
        queuePosition: 0
      }));

      updatedPatients.push(...updatedActive, ...updatedCompleted);
    });

    return updatedPatients;
  };

  // Load today's queue from database
  const loadTodaysQueue = async () => {
    try {
      console.log("🔄 Loading today's queue...");
      const response = await MedqueueAPI.getTodaysAppointments();
      
      if (response.success && response.appointments) {
        const formattedPatients: Patient[] = response.appointments.map((apt: any) => {
          const scheduledTime = apt.scheduledTime ? new Date(apt.scheduledTime) : new Date();
          const doctor = doctors.find(d => d.doctorId === apt.doctorId);
          
          return {
            id: apt.id,
            appointmentId: apt.appointmentId,
            name: apt.name,
            status: apt.status as Status,
            type: apt.type as 'appointment' | 'walk-in',
            queuePosition: 0, // Will be calculated
            timeSlot: {
              start: scheduledTime,
              end: new Date(scheduledTime.getTime() + CONSULTATION_DURATION * 60000)
            },
            scheduledTime,
            email: apt.email,
            patientId: apt.patientId,
            doctorId: apt.doctorId,
            doctorName: doctor ? doctor.name : `Dr. ${apt.doctorId}`
          };
        });
        
        // Calculate queue positions by doctor
        const patientsWithPositions = calculateQueuePositions(formattedPatients);
        
        setAllPatients(patientsWithPositions);
        setLastRefresh(new Date());
        setError("");
        
        console.log(`✅ Loaded ${patientsWithPositions.length} patients`);
      }
    } catch (error: any) {
      console.error("❌ Error loading queue:", error);
      setError(`Failed to load queue: ${error.message}`);
    }
  };

  // Add walk-in patient with doctor selection
  const addWalkInPatient = async () => {
    if (!newWalkInName.trim()) {
      setError("Please enter patient name");
      return;
    }

    if (!selectedWalkInDoctor) {
      setError("Please select a doctor");
      return;
    }

    try {
      setLoading(true);
      
      // Calculate next available time slot for selected doctor
      const nextSlot = getNextAvailableTimeSlot(selectedWalkInDoctor, allPatients);
      const email = `${newWalkInName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@clinic.temp`;
      
      const selectedDoctor = doctors.find(d => d.doctorId === selectedWalkInDoctor);
      console.log(`🔄 Adding walk-in: ${newWalkInName} for ${selectedDoctor?.name} at ${nextSlot.start.toLocaleTimeString()}`);
      
      const response = await MedqueueAPI.createWalkInAppointment(
        newWalkInName.trim(),
        email,
        selectedWalkInDoctor, // Use selected doctor instead of hardcoded DOC001
        nextSlot.start
      );
      
      if (response.success) {
        console.log("✅ Walk-in added successfully");
        setNewWalkInName("");
        setError("");
        await loadTodaysQueue(); // Reload to recalculate positions
      } else {
        setError(`Failed to add walk-in: ${response.message}`);
      }
    } catch (error: any) {
      console.error("❌ Error adding walk-in:", error);
      setError(`Error adding walk-in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update patient status and recalculate queue positions
  const updateStatus = async (patientId: string, newStatus: Status) => {
    try {
      setLoading(true);
      
      const patient = allPatients.find(p => p.id === patientId);
      if (!patient) {
        setError("Patient not found");
        return;
      }

      console.log(`🔄 Updating ${patient.name} to ${newStatus}`);
      
      const response = await MedqueueAPI.updateAppointmentStatus(patient.appointmentId, newStatus);
      
      if (response.success) {
        const updatedPatients = allPatients.map(p => 
          p.id === patientId ? { ...p, status: newStatus } : p
        );
        
        const patientsWithNewPositions = calculateQueuePositions(updatedPatients);
        setAllPatients(patientsWithNewPositions);
        
        console.log(`✅ Status updated for ${patient.name}`);
        setError("");
        
        setTimeout(() => loadTodaysQueue(), 1000);
      } else {
        setError(`Failed to update status: ${response.message}`);
      }
    } catch (error: any) {
      console.error("❌ Error updating status:", error);
      setError(`Error updating status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    Promise.all([loadDoctors(), loadTodaysQueue()]).finally(() => setLoading(false));
  };

  // Enhanced filtering with doctor support
  const filteredPatients = allPatients.filter(patient => {
    const statusMatch = activeFilter === "all" || patient.status === activeFilter;
    const doctorMatch = selectedDoctorFilter === "all" || patient.doctorId === selectedDoctorFilter;
    return statusMatch && doctorMatch;
  });

  const getStatusActions = (status: Status) => {
    switch (status) {
      case "Waiting":
        return [
          { label: "Check In", status: "Arrived" as Status },
          { label: "No Show", status: "No-show" as Status }
        ];
      case "Arrived":
        return [
          { label: "Start Consultation", status: "In consultation" as Status }
        ];
      case "In consultation":
        return [
          { label: "Complete", status: "Completed" as Status }
        ];
      default:
        return [];
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getQueueStatsByDoctor = () => {
    return doctors.map(doctor => {
      const doctorPatients = allPatients.filter(p => p.doctorId === doctor.doctorId);
      const active = doctorPatients.filter(p => ['Waiting', 'Arrived', 'In consultation'].includes(p.status)).length;
      const completed = doctorPatients.filter(p => ['Completed', 'No-show', 'Cancelled'].includes(p.status)).length;
      
      return {
        ...doctor,
        activeCount: active,
        completedCount: completed,
        totalCount: active + completed
      };
    });
  };

  const queueStats = getQueueStatsByDoctor();
  const totalActive = allPatients.filter(p => ['Waiting', 'Arrived', 'In consultation'].includes(p.status)).length;
  const totalCompleted = allPatients.filter(p => ['Completed', 'No-show', 'Cancelled'].includes(p.status)).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with Multi-Doctor Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Medqueue - Multi-Doctor Reception</h1>
          
          {/* Doctor Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {queueStats.map(doctor => (
              <div key={doctor.doctorId} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">{doctor.name}</h3>
                </div>
                <div className="text-sm text-blue-700">
                  <span className="font-medium">{doctor.activeCount} active</span> • 
                  <span className="ml-1">{doctor.completedCount} completed</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">{doctor.specialization}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Total Active: {totalActive}</span>
              <span>Total Completed: {totalCompleted}</span>
              <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
            </div>
            <Button onClick={handleRefresh} disabled={loading} size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}
        </div>

        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="queue">Queue Management</TabsTrigger>
            <TabsTrigger value="walkin">Add Walk-in</TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          <TabsContent value="queue">
            {/* Enhanced Filters */}
            <div className="space-y-4 mb-6">
              {/* Status Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status:</label>
                <div className="flex gap-2 flex-wrap">
                  {["all", "Waiting", "Arrived", "In consultation", "Completed", "No-show"].map((status) => (
                    <Button
                      key={status}
                      variant={activeFilter === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveFilter(status as Status | "all")}
                    >
                      {status} ({status === "all" ? allPatients.length : allPatients.filter(p => p.status === status).length})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Doctor Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Doctor:</label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={selectedDoctorFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDoctorFilter("all")}
                  >
                    All Doctors ({allPatients.length})
                  </Button>
                  {doctors.map((doctor) => (
                    <Button
                      key={doctor.doctorId}
                      variant={selectedDoctorFilter === doctor.doctorId ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDoctorFilter(doctor.doctorId)}
                    >
                      {doctor.name} ({allPatients.filter(p => p.doctorId === doctor.doctorId).length})
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Patient List */}
            <div className="space-y-2">
              {filteredPatients.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                  No patients match the current filters
                </div>
              ) : (
                filteredPatients
                  .sort((a, b) => {
                    // Sort by doctor first, then by queue position
                    if (a.doctorId !== b.doctorId) {
                      return (a.doctorId || '').localeCompare(b.doctorId || '');
                    }
                    if (a.queuePosition && b.queuePosition) {
                      return a.queuePosition - b.queuePosition;
                    }
                    return a.timeSlot.start.getTime() - b.timeSlot.start.getTime();
                  })
                  .map((patient) => (
                    <div key={patient.id} className="bg-white rounded-lg shadow-sm p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center">
                            {patient.queuePosition > 0 ? (
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-800">
                                {patient.queuePosition}
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                                ✓
                              </div>
                            )}
                            <span className="text-xs text-gray-500 mt-1">
                              {patient.doctorName?.replace('Dr. ', '')}
                            </span>
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                className={
                                  patient.status === 'Waiting' ? 'bg-blue-100 text-blue-800' :
                                  patient.status === 'Arrived' ? 'bg-green-100 text-green-800' :
                                  patient.status === 'In consultation' ? 'bg-yellow-100 text-yellow-800' :
                                  patient.status === 'Completed' ? 'bg-gray-100 text-gray-800' :
                                  'bg-red-100 text-red-800'
                                }
                              >
                                {patient.status}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {patient.type === 'appointment' ? '📅 Scheduled' : '🚶 Walk-in'}
                              </span>
                              <span className="text-sm text-gray-600 font-medium">
                                {patient.doctorName}
                              </span>
                              <span className="text-sm text-gray-500">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {formatTime(patient.timeSlot.start)} - {formatTime(patient.timeSlot.end)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {getStatusActions(patient.status).map((action) => (
                            <Button
                              key={action.label}
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(patient.id, action.status)}
                              disabled={loading}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </TabsContent>

          {/* Walk-in Tab */}
          <TabsContent value="walkin">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Add Walk-in Patient</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={newWalkInName}
                    onChange={(e) => setNewWalkInName(e.target.value)}
                    placeholder="Enter patient full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Doctor Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Doctor *
                  </label>
                  <select
                    value={selectedWalkInDoctor}
                    onChange={(e) => setSelectedWalkInDoctor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a doctor...</option>
                    {doctors.map(doctor => (
                      <option key={doctor.doctorId} value={doctor.doctorId}>
                        {doctor.name} - {doctor.specialization}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Show next available slot for selected doctor */}
                {selectedWalkInDoctor && (
                  <div className="p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Next available slot for {doctors.find(d => d.doctorId === selectedWalkInDoctor)?.name}:</strong> {(() => {
                        const nextSlot = getNextAvailableTimeSlot(selectedWalkInDoctor, allPatients);
                        return `${formatTime(nextSlot.start)} - ${formatTime(nextSlot.end)}`;
                      })()}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Queue position: #{allPatients.filter(p => p.doctorId === selectedWalkInDoctor && ['Waiting', 'Arrived', 'In consultation'].includes(p.status)).length + 1}
                    </p>
                  </div>
                )}
                
                <Button 
                  onClick={addWalkInPatient} 
                  disabled={loading || !newWalkInName.trim() || !selectedWalkInDoctor}
                  className="w-full"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Walk-in to Queue
                </Button>
              </div>
            </div>

            {/* Doctor Info Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {doctors.map(doctor => (
                <div key={doctor.doctorId} className="bg-white rounded-lg shadow-sm p-4">
                  <h4 className="font-semibold text-gray-900">{doctor.name}</h4>
                  <p className="text-sm text-gray-600">{doctor.specialization}</p>
                  <p className="text-xs text-gray-500 mt-1">{doctor.experience} years experience</p>
                  <p className="text-xs text-gray-500">{doctor.availability}</p>
                  <div className="mt-2 text-sm">
                    <span className="text-blue-600 font-medium">
                      {allPatients.filter(p => p.doctorId === doctor.doctorId && ['Waiting', 'Arrived', 'In consultation'].includes(p.status)).length} in queue
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
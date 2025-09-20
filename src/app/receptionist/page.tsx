"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Clock, UserPlus, XCircle, Activity, Stethoscope, Hash, Calendar } from "lucide-react";
import MedqueueAPI from "@/lib/api";

type Status = "Waiting" | "Arrived" | "In consultation" | "Completed" | "No-show";
type PatientType = "walk-in" | "appointment";

interface Patient {
  id: string;
  name: string;
  status: Status;
  queueNo: number;
  serviceTime: string; // Expected service time slot
  appointmentId?: string;
  email?: string;
  type: PatientType;
  scheduledTime?: Date; // For appointments
}

const statusColors: Record<Status, string> = {
  Waiting: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border border-slate-200 shadow-sm",
  Arrived: "bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border border-blue-200 shadow-sm shadow-blue-100",
  "In consultation": "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200 shadow-sm shadow-amber-100",
  Completed: "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200 shadow-sm shadow-emerald-100",
  "No-show": "bg-gradient-to-r from-rose-50 to-red-50 text-rose-700 border border-rose-200 shadow-sm shadow-rose-100",
};

const statusActions: { label: string; icon: React.ReactNode; status: Status }[] = [
  { label: "Arrived", icon: <Clock className="w-4 h-4 mr-1" />, status: "Arrived" },
  { label: "Consult", icon: <Activity className="w-4 h-4 mr-1" />, status: "In consultation" },
  { label: "Done", icon: <Check className="w-4 h-4 mr-1" />, status: "Completed" },
  { label: "No-show", icon: <XCircle className="w-4 h-4 mr-1" />, status: "No-show" },
];

function PatientCard({ patient, updateStatus }: { patient: Patient; updateStatus: (id: string, status: Status) => void }) {
  return (
    <Card className="group relative overflow-hidden bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      <div className="relative p-6 flex justify-between items-center">
        <div className="space-y-2">
          <h2 className="font-semibold text-xl text-gray-800 group-hover:text-gray-900 transition-colors flex items-center gap-3">
            <Badge className="bg-gray-200 text-gray-800 flex items-center gap-1 px-2 py-1 rounded-md">
              <Hash className="w-4 h-4" /> {patient.queueNo}
            </Badge>
            {patient.name}
            <Badge className={`${patient.type === 'appointment' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'} text-xs`}>
              {patient.type === 'appointment' ? 'Appointment' : 'Walk-in'}
            </Badge>
          </h2>
          <div className="flex gap-2 items-center">
            <Badge className={`${statusColors[patient.status]} font-medium px-3 py-1 rounded-full text-sm backdrop-blur-sm`}>
              {patient.status}
            </Badge>
            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {patient.serviceTime}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {statusActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant="outline"
              className="rounded-full bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105 text-gray-700 hover:text-gray-900"
              onClick={() => updateStatus(patient.id, action.status)}
            >
              {action.icon} {action.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function ReceptionistDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [newPatient, setNewPatient] = useState("");
  const [appointmentPatient, setAppointmentPatient] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Test API connection on component mount
  useEffect(() => {
    testAPIConnection();
  }, []);

  const testAPIConnection = async () => {
    try {
      const response = await MedqueueAPI.testConnection();
      console.log("API Connection successful:", response);
    } catch (error) {
      console.error("API Connection failed:", error);
      setError("Failed to connect to backend API. Check console for details.");
    }
  };

  // Calculate next available time slot for walk-ins
  const getNextAvailableSlot = (): Date => {
    const now = new Date();
    let nextSlot = new Date();
    
    // Start from current time, round up to next 30-minute slot
    const minutes = now.getMinutes();
    const roundedMinutes = minutes <= 30 ? 30 : 60;
    
    if (roundedMinutes === 60) {
      nextSlot.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      nextSlot.setHours(now.getHours(), roundedMinutes, 0, 0);
    }
    
    // Keep adding 30 minutes until we find an available slot
    let attempts = 0;
    while (attempts < 48) { // Max 24 hours of searching
      const timeSlotTaken = patients.some(p => {
        if (p.scheduledTime) {
          return Math.abs(p.scheduledTime.getTime() - nextSlot.getTime()) < 15 * 60 * 1000; // 15 minute buffer
        }
        return false;
      });
      
      if (!timeSlotTaken) {
        return nextSlot;
      }
      
      // Move to next 30-minute slot
      nextSlot = new Date(nextSlot.getTime() + 30 * 60 * 1000);
      attempts++;
    }
    
    return nextSlot; // Fallback
  };

  // Format time slot for display
  const formatTimeSlot = (date: Date): string => {
    const startTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(date.getTime() + 30 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${startTime}-${endTime}`;
  };

  // Get next queue number
  const getNextQueueNumber = (): number => {
    return patients.length + 1;
  };

  const handleAddWalkIn = async () => {
    if (!newPatient.trim()) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Add timestamp to email to make it unique
      const timestamp = Date.now();
      const email = `${newPatient.toLowerCase().replace(/\s+/g, '.')}.${timestamp}@clinic.com`;
      const nextSlot = getNextAvailableSlot();
      const queueNumber = getNextQueueNumber();
      
      console.log("Adding walk-in patient:", newPatient, "Email:", email);
      const signupResponse = await MedqueueAPI.signupPatient(newPatient, email, "defaultpass123");
      
      if (signupResponse.success) {
        const patientId = signupResponse.patient.id;
        
        const appointmentResponse = await MedqueueAPI.bookAppointment(
          patientId,
          "DOC001",
          nextSlot.toISOString()
        );
        
        if (appointmentResponse.success) {
          const queueResponse = await MedqueueAPI.generateQueueNumber(appointmentResponse.appointmentId);
          
          const newPatientData: Patient = {
            id: patientId,
            name: newPatient,
            status: "Waiting",
            queueNo: queueNumber,
            serviceTime: formatTimeSlot(nextSlot),
            appointmentId: appointmentResponse.appointmentId,
            email: email,
            type: "walk-in",
            scheduledTime: nextSlot
          };
          
          setPatients(prev => [...prev, newPatientData]);
          setNewPatient("");
          console.log("Walk-in patient added successfully:", newPatientData);
        }
      }
    } catch (error) {
      console.error("Error adding walk-in patient:", error);
      setError(`Failed to add walk-in patient: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAppointment = async () => {
    if (!appointmentPatient.trim() || !appointmentTime) return;
    
    setLoading(true);
    setError("");
    
    try {
      const email = `${appointmentPatient.toLowerCase().replace(/\s+/g, '.')}@clinic.com`;
      const appointmentDate = new Date(appointmentTime);
      
      // Check if appointment time conflicts with existing slots
      const conflictingPatient = patients.find(p => {
        if (p.scheduledTime) {
          return Math.abs(p.scheduledTime.getTime() - appointmentDate.getTime()) < 30 * 60 * 1000;
        }
        return false;
      });
      
      if (conflictingPatient) {
        setError("This time slot is already taken. Please choose a different time.");
        setLoading(false);
        return;
      }
      
      // Calculate queue number based on scheduled time relative to existing patients
      const earlierPatients = patients.filter(p => 
        p.scheduledTime && p.scheduledTime < appointmentDate
      ).length;
      
      const queueNumber = earlierPatients + 1;
      
      console.log("Adding appointment patient:", appointmentPatient);
      const signupResponse = await MedqueueAPI.signupPatient(appointmentPatient, email, "defaultpass123");
      
      if (signupResponse.success) {
        const patientId = signupResponse.patient.id;
        
        const appointmentResponse = await MedqueueAPI.bookAppointment(
          patientId,
          "DOC001",
          appointmentDate.toISOString()
        );
        
        if (appointmentResponse.success) {
          const queueResponse = await MedqueueAPI.generateQueueNumber(appointmentResponse.appointmentId);
          
          const newPatientData: Patient = {
            id: patientId,
            name: appointmentPatient,
            status: "Waiting",
            queueNo: queueNumber,
            serviceTime: formatTimeSlot(appointmentDate),
            appointmentId: appointmentResponse.appointmentId,
            email: email,
            type: "appointment",
            scheduledTime: appointmentDate
          };
          
          // Insert appointment in correct position and renumber subsequent patients
          const updatedPatients = [...patients];
          const insertIndex = updatedPatients.findIndex(p => 
            p.scheduledTime && p.scheduledTime > appointmentDate
          );
          
          if (insertIndex === -1) {
            updatedPatients.push(newPatientData);
          } else {
            updatedPatients.splice(insertIndex, 0, newPatientData);
            // Renumber patients after insertion point
            for (let i = insertIndex + 1; i < updatedPatients.length; i++) {
              updatedPatients[i].queueNo = i + 1;
            }
          }
          
          setPatients(updatedPatients);
          setAppointmentPatient("");
          setAppointmentTime("");
        }
      }
    } catch (error) {
      console.error("Error adding appointment:", error);
      setError(`Failed to add appointment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (patientId: string, newStatus: Status) => {
    try {
      const patient = patients.find(p => p.id === patientId);
      if (!patient || !patient.appointmentId) return;

      console.log(`Updating patient ${patient.name} status to: ${newStatus}`);

      if (newStatus === "Arrived") {
        const checkinResponse = await MedqueueAPI.checkInPatient(patient.appointmentId);
        console.log("Check-in response:", checkinResponse);
      }

      setPatients(patients.map((p) => 
        p.id === patientId ? { ...p, status: newStatus } : p
      ));
      
    } catch (error) {
      console.error("Error updating patient status:", error);
      setError(`Failed to update status: ${error.message}`);
    }
  };

  const getCount = (status: Status) => patients.filter((p) => p.status === status).length;

  // Sort patients by scheduled time for display
  const sortedPatients = [...patients].sort((a, b) => {
    if (!a.scheduledTime || !b.scheduledTime) return 0;
    return a.scheduledTime.getTime() - b.scheduledTime.getTime();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="relative p-8 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Stethoscope className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
              Receptionist Dashboard
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Manage patient appointments and track consultation status</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button 
              onClick={() => setError("")} 
              className="ml-4 text-red-900 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Add Patients Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Walk-in Patients */}
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center gap-3 text-gray-800">
                <div className="p-2 bg-green-100 rounded-xl">
                  <UserPlus className="w-5 h-5 text-green-600" />
                </div>
                Add Walk-in Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Input
                placeholder="Enter patient name..."
                value={newPatient}
                onChange={(e) => setNewPatient(e.target.value)}
                className="flex-1 rounded-2xl border-gray-200 bg-white/80"
                disabled={loading}
              />
              <Button 
                onClick={handleAddWalkIn} 
                disabled={loading || !newPatient.trim()}
                className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                {loading ? "Adding..." : "Add"}
              </Button>
            </CardContent>
          </Card>

          {/* Scheduled Appointments */}
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center gap-3 text-gray-800">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                Add Scheduled Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Enter patient name..."
                value={appointmentPatient}
                onChange={(e) => setAppointmentPatient(e.target.value)}
                className="rounded-2xl border-gray-200 bg-white/80"
                disabled={loading}
              />
              <Input
                type="datetime-local"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="rounded-2xl border-gray-200 bg-white/80"
                disabled={loading}
              />
              <Button 
                onClick={handleAddAppointment} 
                disabled={loading || !appointmentPatient.trim() || !appointmentTime}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                {loading ? "Adding..." : "Schedule Appointment"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="All" className="space-y-6">
          <TabsList className="grid grid-cols-6 gap-2 bg-white/70 backdrop-blur-sm p-2 rounded-2xl border-0 shadow-lg">
            <TabsTrigger value="All" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white shadow-lg">
              All ({patients.length})
            </TabsTrigger>
            {(Object.keys(statusColors) as Status[]).map((status) => (
              <TabsTrigger key={status} value={status} className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white shadow-lg">
                {status} ({getCount(status)})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="All" className="space-y-4">
            {sortedPatients.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No patients in queue. Add walk-ins or schedule appointments to get started.
              </div>
            ) : (
              sortedPatients.map((p, i) => (
                <div key={p.id} className="animate-in slide-in-from-left duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                  <PatientCard patient={p} updateStatus={updateStatus} />
                </div>
              ))
            )}
          </TabsContent>

          {(Object.keys(statusColors) as Status[]).map((status) => (
            <TabsContent value={status} key={status} className="space-y-4">
              {sortedPatients.filter((p) => p.status === status).map((p, i) => (
                <div key={p.id} className="animate-in slide-in-from-left duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                  <PatientCard patient={p} updateStatus={updateStatus} />
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Clock, UserPlus, XCircle, Activity, Stethoscope, Hash } from "lucide-react";

type Status = "Waiting" | "Arrived" | "In consultation" | "Completed" | "No-show";

interface Patient {
  id: number;
  name: string;
  status: Status;
  queueNo: number; 
}
//test
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

function PatientCard({ patient, updateStatus }: { patient: Patient; updateStatus: (id: number, status: Status) => void }) {
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
          </h2>
          <Badge className={`${statusColors[patient.status]} font-medium px-3 py-1 rounded-full text-sm backdrop-blur-sm`}>
            {patient.status}
          </Badge>
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
  const [patients, setPatients] = useState<Patient[]>([
    { id: 1, name: "John Doe", status: "Arrived", queueNo: 1 },
    { id: 2, name: "Jane Smith", status: "In consultation", queueNo: 2 },
    { id: 3, name: "Alice Johnson", status: "Completed", queueNo: 3 },
  ]);
  const [newPatient, setNewPatient] = useState("");
  const [nextQueueNo, setNextQueueNo] = useState(4); 
  const handleAddPatient = () => {
    if (!newPatient.trim()) return;
    setPatients([
      ...patients,
      { id: patients.length + 1, name: newPatient, status: "Waiting", queueNo: nextQueueNo },
    ]);
    setNewPatient("");
    setNextQueueNo(nextQueueNo + 1); // increment queue number
  };

  const updateStatus = (id: number, newStatus: Status) => {
    setPatients(patients.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
  };

  const getCount = (status: Status) => patients.filter((p) => p.status === status).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
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

        {/* Add Walk-in Patients */}
        <Card className="mb-8 bg-white/70 backdrop-blur-sm border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="relative">
            <CardTitle className="text-xl font-semibold flex items-center gap-3 text-gray-800">
              <div className="p-2 bg-blue-100 rounded-xl">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              Add Walk-in Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="relative flex gap-4">
            <Input
              placeholder="Enter patient name..."
              value={newPatient}
              onChange={(e) => setNewPatient(e.target.value)}
              className="flex-1 rounded-2xl border-gray-200 bg-white/80 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 text-lg py-6"
            />
            <Button 
              onClick={handleAddPatient} 
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 px-8 py-6 text-lg font-medium"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Patient
            </Button>
          </CardContent>
        </Card>

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

          {/* All Patients */}
          <TabsContent value="All" className="space-y-4">
            {patients.map((p, i) => (
              <div key={p.id} className="animate-in slide-in-from-left duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                <PatientCard patient={p} updateStatus={updateStatus} />
              </div>
            ))}
          </TabsContent>

          {/* Filtered Patients */}
          {(Object.keys(statusColors) as Status[]).map((status) => (
            <TabsContent value={status} key={status} className="space-y-4">
              {patients.filter((p) => p.status === status).map((p, i) => (
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

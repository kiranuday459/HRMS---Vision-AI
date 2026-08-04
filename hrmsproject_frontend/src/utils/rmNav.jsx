import React from 'react';
import {
    LayoutDashboard,
    Users,
    Clock,
    CalendarDays,
    FileText,
    History
} from 'lucide-react';

export const getRmNavItems = (activeTab) => [
    {
        type: "heading",
        label: "Personal Workspace"
    },
    {
        tab: "dashboard",
        label: "Dashboard",
        to: "/manager/dashboard",
        icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
        tab: "timesheet",
        label: "My Timesheet",
        to: "/manager/timesheet",
        icon: <Clock className="w-5 h-5" />
    },
    {
        tab: "leave",
        label: "Leave Request",
        to: "/manager/leave",
        icon: <CalendarDays className="w-5 h-5" />
    },
    {
        type: "heading",
        label: "Team Management"
    },
    {
        tab: "team",
        label: "Team Members",
        to: "/manager/team",
        icon: <Users className="w-5 h-5" />
    },
    {
        tab: "team-timesheets",
        label: "Team Timesheets",
        to: "/manager/timesheets",
        icon: <FileText className="w-5 h-5" />
    },
    {
        tab: "team-leaves",
        label: "Team Leaves",
        to: "/manager/leaves",
        icon: <History className="w-5 h-5" />
    }
];



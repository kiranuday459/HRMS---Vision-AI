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
        to: "/manager?tab=dashboard",
        icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
        tab: "timesheet",
        label: "My Timesheet",
        to: "/manager?tab=timesheet",
        icon: <Clock className="w-5 h-5" />
    },
    {
        tab: "leave",
        label: "Leave Request",
        to: "/manager?tab=leave",
        icon: <CalendarDays className="w-5 h-5" />
    },
    {
        type: "heading",
        label: "Team Management"
    },
    {
        tab: "team",
        label: "Team Members",
        to: "/reporting-team?view=team",
        icon: <Users className="w-5 h-5" />
    },
    {
        tab: "team-timesheets",
        label: "Team Timesheets",
        to: "/reporting-team?view=timesheets",
        icon: <FileText className="w-5 h-5" />
    },
    {
        tab: "team-leaves",
        label: "Team Leaves",
        to: "/reporting-team?view=leaves",
        icon: <History className="w-5 h-5" />
    }
];



import React from 'react';
import { FileText, History, LayoutDashboard, Clock, CalendarDays, Users, UsersRound } from 'lucide-react';

export const getHrNavItems = () => [
    {
        type: "heading",
        label: "Personal Workspace"
    },
    {
        tab: "dashboard",
        label: "Dashboard",
        icon: <LayoutDashboard className="w-5 h-5" />,
        to: "/hr/dashboard"
    },
    {
        tab: "timesheet",
        label: "My Timesheet",
        icon: <Clock className="w-5 h-5" />,
        to: "/hr/timesheet"
    },
    {
        tab: "leave",
        label: "Leave Request",
        icon: <CalendarDays className="w-5 h-5" />,
        to: "/hr/leave"
    },
    {
        type: "heading",
        label: "HR Operations"
    },
    {
        tab: "actions_dashboard",
        label: "Dashboard",
        to: "/hr/actions",
        icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
        tab: "candidates",
        label: "Employees",
        to: "/hr/actions/candidates",
        icon: <Users className="w-5 h-5" />
    },
    {
        tab: "managers",
        label: "Reporting Managers",
        to: "/hr/actions/reporting-managers",
        icon: <UsersRound className="w-5 h-5" />
    },
    {
        tab: "leaves",
        label: "Team Leaves",
        to: "/hr/actions/leaves",
        icon: <History className="w-5 h-5" />
    },
    {
        tab: "timesheets",
        label: "Team Timesheets",
        to: "/hr/actions/timesheet",
        icon: <FileText className="w-5 h-5" />
    },
];



import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "./api";

/**
 * Format date string safely into readable format (YYYY-MM-DD)
 */
const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split("T")[0];
  } catch (e) {
    return dateStr;
  }
};

/**
 * Generates and downloads a complete Employee Profile PDF
 * @param {string|number|object} employeeOrId - Employee ID or full employee object
 * @param {function} showToast - Optional toast notification function
 */
export async function generateEmployeeProfilePDF(employeeOrId, showToast = null) {
  try {
    let emp = null;
    let leaveBalance = null;

    // Fetch full employee details if ID is provided or object lacks deep nested lists
    if (typeof employeeOrId === "object" && employeeOrId !== null) {
      emp = employeeOrId;
      // If nested lists missing, re-fetch full profile
      if ((!emp.educationList && !emp.experienceList && emp.id) || !emp.aadhaarNo) {
        try {
          const res = await api(`/api/employees/${emp.id}`);
          if (res.ok) {
            const json = await res.json();
            emp = json.data || json || emp;
          }
        } catch (e) {
          console.warn("Could not fetch full employee details, using provided data", e);
        }
      }
    } else if (employeeOrId) {
      const res = await api(`/api/employees/${employeeOrId}`);
      if (!res.ok) {
        throw new Error("Failed to load employee details for PDF generation.");
      }
      const json = await res.json();
      emp = json.data || json;
    }

    if (!emp) {
      throw new Error("No employee data available.");
    }

    // Attempt to fetch leave balance if employee ID exists
    if (emp.id) {
      try {
        const lbRes = await api(`/api/leaves/balance/${emp.id}`);
        if (lbRes.ok) {
          const lbJson = await lbRes.json();
          leaveBalance = lbJson.data || lbJson;
        }
      } catch (e) {
        console.warn("Leave balance unavailable for PDF", e);
      }
    }

    // Construct full name
    const firstName = emp.firstName || "";
    const middleName = emp.middleName ? ` ${emp.middleName}` : "";
    const lastName = emp.lastName ? ` ${emp.lastName}` : "";
    const fullName = `${firstName}${middleName}${lastName}`.trim() || "Employee";

    // Create PDF Document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 12;

    // BRAND HEADER BAR
    doc.setFillColor(15, 23, 42); // slate-900 #0F172A
    doc.rect(0, 0, pageWidth, 28, "F");

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("VISION AI HRMS", 14, 12);

    doc.setFontSize(10);
    doc.setTextColor(245, 158, 11); // amber-500 #F59E0B
    doc.text("EMPLOYEE PROFILE RECORD", 14, 19);

    // Right-aligned Timestamp
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    const now = new Date();
    const generatedDateStr = `Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(generatedDateStr, pageWidth - 14, 19, { align: "right" });

    // Decorative Accent Line below header
    doc.setFillColor(245, 158, 11); // amber accent
    doc.rect(0, 28, pageWidth, 1.5, "F");

    currentY = 36;

    // SUMMARY CARD BOX
    doc.setFillColor(248, 250, 252); // slate-50 #F8FAFC
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, currentY, pageWidth - 28, 28, 3, 3, "FD");

    // Primary Summary Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(fullName, 18, currentY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const roleText = emp.designation || emp.role || "Personnel";
    doc.text(`Role: ${roleText}`, 18, currentY + 16);

    const empIdText = emp.oryfolksId ? `EMP ID: ${emp.oryfolksId}` : `System ID: #${emp.id || "N/A"}`;
    doc.text(empIdText, 18, currentY + 22);

    // Right side Summary Info
    const rightColX = pageWidth - 18;
    const statusText = emp.active === false ? "STATUS: INACTIVE" : "STATUS: ACTIVE";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (emp.active === false) {
      doc.setTextColor(220, 38, 38); // Red
    } else {
      doc.setTextColor(16, 185, 129); // Green
    }
    doc.text(statusText, rightColX, currentY + 9, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Email: ${emp.corporateEmail || emp.email || "N/A"}`, rightColX, currentY + 16, { align: "right" });
    doc.text(`Joining Date: ${formatDate(emp.joiningDate)}`, rightColX, currentY + 22, { align: "right" });

    currentY += 34;

    // Helper for Section Headings
    const addSectionHeading = (title) => {
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(title.toUpperCase(), 14, currentY);

      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.4);
      doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);
      currentY += 7;
    };

    // SECTION 1: PERSONAL INFORMATION
    addSectionHeading("1. Personal Details");

    const personalData = [
      [
        { content: "Full Name:", fontStyle: "bold" }, fullName,
        { content: "Date of Birth:", fontStyle: "bold" }, formatDate(emp.dateOfBirth)
      ],
      [
        { content: "Gender:", fontStyle: "bold" }, emp.gender || "N/A",
        { content: "Marital Status:", fontStyle: "bold" }, emp.maritalStatus || "N/A"
      ],
      [
        { content: "Blood Group:", fontStyle: "bold" }, emp.bloodGroup || "N/A",
        { content: "Personal Email:", fontStyle: "bold" }, emp.email || emp.personalEmail || "N/A"
      ],
      [
        { content: "Mobile Number:", fontStyle: "bold" }, emp.phoneNumber || "N/A",
        { content: "Alternate Mobile:", fontStyle: "bold" }, emp.alternatePhone || "N/A"
      ],
      [
        { content: "Aadhaar Number:", fontStyle: "bold" }, emp.aadhaarNo || emp.addressProofNumber || "N/A",
        { content: "PAN Number:", fontStyle: "bold" }, emp.panNo || "N/A"
      ],
      [
        { content: "Passport Number:", fontStyle: "bold" }, emp.passportNo || "N/A",
        { content: "Corporate Email:", fontStyle: "bold" }, emp.corporateEmail || "N/A"
      ],
      [
        { content: "Present Address:", fontStyle: "bold" }, emp.presentAddress || emp.address || "N/A",
        { content: "Permanent Address:", fontStyle: "bold" }, emp.permanentAddress || emp.presentAddress || "N/A"
      ]
    ];

    autoTable(doc, {
      startY: currentY,
      body: personalData,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: [51, 65, 85], // slate-700
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: "bold", textColor: [15, 23, 42] },
        1: { cellWidth: 55 },
        2: { cellWidth: 35, fontStyle: "bold", textColor: [15, 23, 42] },
        3: { cellWidth: 57 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // SECTION 2: EMERGENCY CONTACT
    addSectionHeading("2. Emergency Contact Information");

    const emergencyData = [
      [
        { content: "Contact Person:", fontStyle: "bold" }, emp.emergencyContactName || "N/A",
        { content: "Relationship:", fontStyle: "bold" }, emp.emergencyRelationship || "N/A"
      ],
      [
        { content: "Phone Number:", fontStyle: "bold" }, emp.emergencyPhone || "N/A",
        { content: "Address:", fontStyle: "bold" }, emp.emergencyAddress || "N/A"
      ]
    ];

    autoTable(doc, {
      startY: currentY,
      body: emergencyData,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: "bold", textColor: [15, 23, 42] },
        1: { cellWidth: 55 },
        2: { cellWidth: 35, fontStyle: "bold", textColor: [15, 23, 42] },
        3: { cellWidth: 57 }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // SECTION 3: EDUCATION HISTORY
    addSectionHeading("3. Education Details");

    const eduList = Array.isArray(emp.educationList) ? emp.educationList : [];
    const eduRows = eduList.map((edu) => [
      edu.institutionName || "N/A",
      edu.degreeLevel || "N/A",
      edu.startYear || "N/A",
      edu.endYear || "N/A"
    ]);

    if (eduRows.length === 0) {
      eduRows.push(["No educational background recorded", "-", "-", "-"]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [["Institution / University", "Degree / Level", "Start Year", "End Year"]],
      body: eduRows,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: "bold"
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [51, 65, 85],
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // SECTION 4: EMPLOYMENT HISTORY
    addSectionHeading("4. Employment History");

    const expList = Array.isArray(emp.experienceList) ? emp.experienceList : [];
    const expRows = expList.map((exp) => {
      const dates = `${formatDate(exp.startDate)} to ${formatDate(exp.endDate) || "Present"}`;
      const manager = exp.reportingManagerName ? `${exp.reportingManagerName} (${exp.reportingManagerEmail || 'N/A'})` : "N/A";
      return [
        exp.employerName || "N/A",
        exp.designation || "N/A",
        exp.businessType || "N/A",
        dates,
        manager
      ];
    });

    if (expRows.length === 0) {
      expRows.push(["No prior employment history recorded", "-", "-", "-", "-"]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [["Employer Name", "Designation", "Business Type", "Duration", "Reporting Manager"]],
      body: expRows,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: "bold"
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [51, 65, 85],
      },
      margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // SECTION 5: LEAVE BALANCES (If available)
    if (leaveBalance) {
      addSectionHeading("5. Leave Balances Summary");

      const lbRows = [
        ["Annual Leave", leaveBalance.annualLeaveAllocated ?? "N/A", leaveBalance.annualLeaveUsed ?? "N/A", leaveBalance.annualLeaveBalance ?? "N/A"],
        ["Sick Leave", leaveBalance.sickLeaveAllocated ?? "N/A", leaveBalance.sickLeaveUsed ?? "N/A", leaveBalance.sickLeaveBalance ?? "N/A"],
        ["Casual Leave", leaveBalance.casualLeaveAllocated ?? "N/A", leaveBalance.casualLeaveUsed ?? "N/A", leaveBalance.casualLeaveBalance ?? "N/A"]
      ];

      autoTable(doc, {
        startY: currentY,
        head: [["Leave Type", "Allocated", "Used", "Available Balance"]],
        body: lbRows,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
        },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 8;
    }

    // Add Page Numbers and Footer to all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400

      // Divider line at bottom
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.text("CONFIDENTIAL - Vision AI HRMS Profile Record", 14, pageHeight - 7);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: "right" });
    }

    // Save and Trigger Browser Download
    const cleanFileName = fullName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Employee_Profile_${cleanFileName}.pdf`;
    doc.save(filename);

    if (showToast) {
      showToast(`Profile PDF downloaded successfully for ${fullName}`, "success");
    }
  } catch (error) {
    console.error("Failed to generate employee profile PDF:", error);
    if (showToast) {
      showToast(error.message || "Failed to download profile PDF", "error");
    } else {
      alert(error.message || "Failed to download profile PDF");
    }
  }
}

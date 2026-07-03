import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { serializePhotoUrls } from '../src/utils/prisma.js';

const prisma = new PrismaClient();

const CR = 1e7; // 1 Crore
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.approvalAction.deleteMany();
  await prisma.fundDemand.deleteMany();
  await prisma.progressEntry.deleteMany();
  await prisma.workAssignment.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.departmentAllocation.deleteMany();
  await prisma.schemePart.deleteMany();
  await prisma.scheme.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.district.deleteMany();
  await prisma.department.deleteMany();
  await prisma.state.deleteMany();

  const state = await prisma.state.create({ data: { name: 'Maharashtra' } });

  const departments = await Promise.all(
    [
      'Rural Development',
      'PWD-Roads',
      'Urban Infrastructure',
      'Water Resources',
      'Education Infra',
      'Health & Family Welfare',
    ].map((name) =>
      prisma.department.create({
        data: { name, stateId: state.id, reportingStructure: 'State Level' },
      })
    )
  );

  const [ruralDev, pwd, urban, water, education, health] = departments;

  const districts = await Promise.all(
    ['Nashik', 'Pune', 'Nagpur', 'Aurangabad', 'Kolhapur', 'Solapur', 'Satara', 'Amravati', 'Thane'].map((name) =>
      prisma.district.create({ data: { name, stateId: state.id } })
    )
  );
  const [nashik, pune, nagpur, aurangabad, kolhapur, solapur, satara, amravati, thane] = districts;

  const passwordHash = await bcrypt.hash('password123', 10);

  const users = {
    admin: await prisma.user.create({
      data: {
        employeeCode: 'PMU-MH-00001',
        name: 'State PMU Admin',
        email: 'pmu@sasci.gov.in',
        passwordHash,
        role: 'STATE_PMU',
      },
    }),
    deptOfficer: await prisma.user.create({
      data: {
        employeeCode: 'DOE-MH-04471',
        name: 'Department Officer',
        email: 'dept@sasci.gov.in',
        passwordHash,
        role: 'DEPARTMENT_OFFICER',
        departmentId: pwd.id,
      },
    }),
    fieldOfficerRural: await prisma.user.create({
      data: {
        employeeCode: 'FO-MH-10233',
        name: 'M. Jadhav',
        email: 'field.rural@sasci.gov.in',
        passwordHash,
        role: 'FIELD_OFFICER',
        departmentId: ruralDev.id,
      },
    }),
    fieldOfficerWater: await prisma.user.create({
      data: {
        employeeCode: 'FO-MH-10235',
        name: 'V. Kulkarni',
        email: 'field.water@sasci.gov.in',
        passwordHash,
        role: 'FIELD_OFFICER',
        departmentId: water.id,
        status: 'inactive',
      },
    }),
    fieldOfficerEdu: await prisma.user.create({
      data: {
        employeeCode: 'FO-MH-10237',
        name: 'P. Shinde',
        email: 'field.edu@sasci.gov.in',
        passwordHash,
        role: 'FIELD_OFFICER',
        departmentId: education.id,
        status: 'inactive',
      },
    }),
    fieldOfficerHealth: await prisma.user.create({
      data: {
        employeeCode: 'FO-MH-10238',
        name: 'A. Pawar',
        email: 'field.health@sasci.gov.in',
        passwordHash,
        role: 'FIELD_OFFICER',
        departmentId: health.id,
      },
    }),
    fieldOfficerPwd2: await prisma.user.create({
      data: {
        employeeCode: 'FO-MH-10239',
        name: 'K. Gaikwad',
        email: 'field.pwd2@sasci.gov.in',
        passwordHash,
        role: 'FIELD_OFFICER',
        departmentId: pwd.id,
        status: 'inactive',
      },
    }),
    fieldOfficerUrban2: await prisma.user.create({
      data: {
        employeeCode: 'FO-MH-10240',
        name: 'A. Sharma',
        email: 'field.urban2@sasci.gov.in',
        passwordHash,
        role: 'FIELD_OFFICER',
        departmentId: urban.id,
        status: 'inactive',
      },
    }),
    checker: await prisma.user.create({
      data: {
        employeeCode: 'CHK-MH-20001',
        name: 'S. Patil',
        email: 'checker@sasci.gov.in',
        passwordHash,
        role: 'CHECKER',
      },
    }),
    finance: await prisma.user.create({
      data: {
        employeeCode: 'FIN-MH-30001',
        name: 'A. Joshi',
        email: 'finance@sasci.gov.in',
        passwordHash,
        role: 'FINANCE_OFFICER',
      },
    }),
    approver: await prisma.user.create({
      data: {
        employeeCode: 'APP-MH-40001',
        name: 'Approver',
        email: 'approver@sasci.gov.in',
        passwordHash,
        role: 'APPROVER',
      },
    }),
    auditor: await prisma.user.create({
      data: {
        employeeCode: 'AUD-MH-50001',
        name: 'Auditor Account',
        email: 'auditor@sasci.gov.in',
        passwordHash,
        role: 'AUDITOR',
      },
    }),
    sysAdmin: await prisma.user.create({
      data: {
        employeeCode: 'ADM-MH-90001',
        name: 'System Admin',
        email: 'admin@sasci.gov.in',
        passwordHash,
        role: 'SYSTEM_ADMIN',
      },
    }),
  };

  const schemes = await Promise.all(
    [
      { code: 'NVY-2026', name: 'Nagar Vikas Yojna', ceiling: 1200 * CR },
      { code: 'GSY-2026', name: 'Gram Sadak Yojna', ceiling: 950 * CR },
      { code: 'JJY-2026', name: 'Jal Jeevan Yojna', ceiling: 800 * CR },
      { code: 'LPY-2026', name: 'Ladki Padhao Yojna', ceiling: 600 * CR },
      { code: 'ARY-2026', name: 'Arogya Nirman Yojna', ceiling: 700 * CR },
    ].map((s) =>
      prisma.scheme.create({
        data: {
          schemeCode: s.code,
          schemeName: s.name,
          financialYear: '2026-27',
          schemeCeilingAmount: s.ceiling,
          status: 'active',
          createdById: users.admin.id,
          parts: {
            create: [
              { partName: 'Part A — Civil Works', partDescription: 'Primary civil infrastructure' },
              { partName: 'Part B — Equipment', partDescription: 'Equipment and machinery' },
            ],
          },
        },
        include: { parts: true },
      })
    )
  );

  const [urbanScheme, ruralScheme, waterScheme, eduScheme, healthScheme] = schemes;

  await prisma.departmentAllocation.createMany({
    data: [
      { schemeId: ruralScheme.id, departmentId: ruralDev.id, allocatedAmount: 400 * CR, financialYear: '2026-27' },
      { schemeId: ruralScheme.id, departmentId: pwd.id, allocatedAmount: 350 * CR, financialYear: '2026-27' },
      { schemeId: urbanScheme.id, departmentId: urban.id, allocatedAmount: 500 * CR, financialYear: '2026-27' },
      { schemeId: waterScheme.id, departmentId: water.id, allocatedAmount: 400 * CR, financialYear: '2026-27' },
      { schemeId: eduScheme.id, departmentId: education.id, allocatedAmount: 300 * CR, financialYear: '2026-27' },
      { schemeId: healthScheme.id, departmentId: health.id, allocatedAmount: 350 * CR, financialYear: '2026-27' },
    ],
  });

  const vendors = await Promise.all(
    ['Maharashtra Infra Ltd', 'BOM Contractors', 'State Works Co', 'Konkan Builders Pvt Ltd', 'Vidarbha Construction Co'].map((name, i) =>
      prisma.vendor.create({
        data: { name, registrationNumber: `VND-MH-${1000 + i}`, contactDetails: 'Maharashtra' },
      })
    )
  );
  const [vendorInfra, vendorBom, vendorStateWorks, vendorKonkan, vendorVidarbha] = vendors;

  const [ruralProject, pwdProject, waterProject, urbanProject, eduProject, healthProject, sataraProject, amravatiProject, thaneProject] = await Promise.all([
    prisma.project.create({
      data: {
        projectCode: 'PRJ-KOL-005',
        projectName: 'Kolhapur Village Road Network',
        schemeId: ruralScheme.id,
        schemePartId: ruralScheme.parts[0].id,
        departmentId: ruralDev.id,
        districtId: kolhapur.id,
        approvedCost: 120 * CR,
        geoLat: 16.705,
        geoLong: 74.2433,
        vendorId: vendors[0].id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(55),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-NSK-001',
        projectName: 'Nashik Rural Road Phase II',
        schemeId: ruralScheme.id,
        schemePartId: ruralScheme.parts[0].id,
        departmentId: pwd.id,
        districtId: nashik.id,
        approvedCost: 130 * CR,
        geoLat: 19.9975,
        geoLong: 73.7898,
        vendorId: vendors[0].id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(60),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-PUN-002',
        projectName: 'Pune Water Pipeline Ext.',
        schemeId: waterScheme.id,
        schemePartId: waterScheme.parts[0].id,
        departmentId: water.id,
        districtId: pune.id,
        approvedCost: 110 * CR,
        geoLat: 18.5204,
        geoLong: 73.8567,
        vendorId: vendors[1].id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(45),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-NGP-003',
        projectName: 'Nagpur Urban Drainage',
        schemeId: urbanScheme.id,
        schemePartId: urbanScheme.parts[0].id,
        departmentId: urban.id,
        districtId: nagpur.id,
        approvedCost: 140 * CR,
        geoLat: 21.1458,
        geoLong: 79.0882,
        vendorId: vendors[2].id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(50),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-AUR-004',
        projectName: 'Aurangabad School Block',
        schemeId: eduScheme.id,
        schemePartId: eduScheme.parts[0].id,
        departmentId: education.id,
        districtId: aurangabad.id,
        approvedCost: 90 * CR,
        geoLat: 19.8762,
        geoLong: 75.3433,
        vendorId: vendors[0].id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(30),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-SOL-006',
        projectName: 'Solapur District Hospital Upgrade',
        schemeId: healthScheme.id,
        schemePartId: healthScheme.parts[0].id,
        departmentId: health.id,
        districtId: solapur.id,
        approvedCost: 100 * CR,
        geoLat: 17.6599,
        geoLong: 75.9064,
        vendorId: vendors[1].id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(40),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-SAT-007',
        projectName: 'Satara-Karad Highway Widening',
        schemeId: ruralScheme.id,
        schemePartId: ruralScheme.parts[0].id,
        departmentId: pwd.id,
        districtId: satara.id,
        approvedCost: 100 * CR,
        geoLat: 17.6805,
        geoLong: 74.0183,
        vendorId: vendorBom.id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(25),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-AMR-008',
        projectName: 'Amravati Irrigation Canal Upgrade',
        schemeId: waterScheme.id,
        schemePartId: waterScheme.parts[0].id,
        departmentId: water.id,
        districtId: amravati.id,
        approvedCost: 90 * CR,
        geoLat: 20.9374,
        geoLong: 77.7796,
        vendorId: vendorKonkan.id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(20),
      },
    }),
    prisma.project.create({
      data: {
        projectCode: 'PRJ-THN-009',
        projectName: 'Thane Smart Roads Initiative',
        schemeId: urbanScheme.id,
        schemePartId: urbanScheme.parts[0].id,
        departmentId: urban.id,
        districtId: thane.id,
        approvedCost: 110 * CR,
        geoLat: 19.2183,
        geoLong: 72.9781,
        vendorId: vendorVidarbha.id,
        status: 'in_execution',
        createdById: users.deptOfficer.id,
        sanctionedById: users.deptOfficer.id,
        sanctionedAt: daysAgo(18),
      },
    }),
  ]);

  async function workItem(opts: {
    code: string;
    project: { id: string };
    name: string;
    cost: number;
    status: 'unassigned' | 'assigned' | 'in_progress' | 'completed';
    officer?: { id: string };
    vendor?: { id: string };
    targetDaysAhead?: number;
    progress?: { percent: number; verified: boolean; submittedDaysAgo: number; note: string; lat: number; long: number };
  }) {
    const item = await prisma.workItem.create({
      data: {
        workCode: opts.code,
        projectId: opts.project.id,
        workName: opts.name,
        workCost: opts.cost * CR,
        status: opts.status,
        vendorId: opts.vendor?.id,
      },
    });
    if (opts.officer) {
      await prisma.workAssignment.create({
        data: {
          workItemId: item.id,
          assignedOfficerId: opts.officer.id,
          targetCompletionDate: daysAgo(-(opts.targetDaysAhead ?? 30)),
        },
      });
    }
    if (opts.progress) {
      const entry = await prisma.progressEntry.create({
        data: {
          workItemId: item.id,
          submittedById: opts.officer!.id,
          progressPercent: opts.progress.percent,
          geoLat: opts.progress.lat,
          geoLong: opts.progress.long,
          photoUrls: serializePhotoUrls(['/uploads/demo-photo.png']),
          milestoneNote: opts.progress.note,
          verified: opts.progress.verified,
          submittedAt: daysAgo(opts.progress.submittedDaysAgo),
        },
      });
      if (opts.progress.percent === 100) {
        await prisma.document.create({
          data: {
            fileUrl: '/uploads/demo-bill.pdf',
            fileName: `completion-certificate-${opts.code}.pdf`,
            documentType: 'completion_certificate',
            uploadedById: opts.officer!.id,
            progressEntryId: entry.id,
          },
        });
      }
    }
    return item;
  }

  const wkRural1 = await workItem({
    code: 'WK-KOL-001', project: ruralProject, name: 'Village Road Network — Cluster A', cost: 70,
    status: 'completed', officer: users.fieldOfficerRural, vendor: vendorInfra,
    progress: { percent: 100, verified: true, submittedDaysAgo: 14, note: 'Cluster A road network complete', lat: 16.706, long: 74.244 },
  });
  await workItem({ code: 'WK-KOL-002', project: ruralProject, name: 'Village Road Network — Cluster B', cost: 40, status: 'unassigned' });

  const wkPwd1 = await workItem({
    code: 'WK-NSK-001', project: pwdProject, name: 'Road Grading & Paving — Segment A', cost: 55,
    status: 'completed', officer: users.fieldOfficerPwd2,
    progress: { percent: 100, verified: true, submittedDaysAgo: 12, note: 'Segment A paving complete', lat: 19.9982, long: 73.7905 },
  });
  const wkPwd2 = await workItem({
    code: 'WK-NSK-002', project: pwdProject, name: 'Drainage Works — Segment B', cost: 45,
    status: 'in_progress', officer: users.fieldOfficerPwd2, vendor: vendorStateWorks,
    progress: { percent: 65, verified: true, submittedDaysAgo: 4, note: 'Drainage lining 65% complete', lat: 19.999, long: 73.792 },
  });
  await workItem({ code: 'WK-NSK-003', project: pwdProject, name: 'Culvert Construction — Segment C', cost: 30, status: 'unassigned' });

  const wkWater1 = await workItem({
    code: 'WK-PUN-001', project: waterProject, name: 'Pipeline Laying — Phase 1', cost: 60,
    status: 'in_progress', officer: users.fieldOfficerWater,
    progress: { percent: 50, verified: true, submittedDaysAgo: 6, note: 'Pipeline trenching and laying 50% complete', lat: 18.521, long: 73.857 },
  });
  await workItem({
    code: 'WK-PUN-002', project: waterProject, name: 'Pump House Construction', cost: 30,
    status: 'in_progress', officer: users.fieldOfficerWater,
    progress: { percent: 30, verified: false, submittedDaysAgo: 1, note: 'Foundation work 30% complete — awaiting checker site visit', lat: 18.519, long: 73.858 },
  });
  const wkWater3 = await workItem({
    code: 'WK-PUN-003', project: waterProject, name: 'Overhead Tank Construction', cost: 20,
    status: 'completed', officer: users.fieldOfficerWater,
    progress: { percent: 100, verified: true, submittedDaysAgo: 9, note: 'Overhead tank construction complete', lat: 18.522, long: 73.859 },
  });

  const wkUrban1 = await workItem({
    code: 'WK-NGP-001', project: urbanProject, name: 'Storm Water Drain — North Zone', cost: 70,
    status: 'in_progress', officer: users.fieldOfficerUrban2,
    progress: { percent: 80, verified: true, submittedDaysAgo: 8, note: 'Drain lining 80% complete across North Zone', lat: 21.146, long: 79.089 },
  });
  const wkUrban2 = await workItem({
    code: 'WK-NGP-002', project: urbanProject, name: 'Storm Water Drain — South Zone', cost: 40,
    status: 'in_progress', officer: users.fieldOfficerUrban2,
    progress: { percent: 20, verified: true, submittedDaysAgo: 9, note: 'Excavation 20% complete', lat: 21.144, long: 79.087 },
  });
  await workItem({ code: 'WK-NGP-003', project: urbanProject, name: 'Storm Water Pump Station', cost: 30, status: 'unassigned' });

  const wkEdu1 = await workItem({
    code: 'WK-AUR-001', project: eduProject, name: 'Classroom Block Construction', cost: 50,
    status: 'completed', officer: users.fieldOfficerEdu,
    progress: { percent: 100, verified: true, submittedDaysAgo: 11, note: 'Classroom block complete and handed over', lat: 19.877, long: 75.344 },
  });
  await workItem({ code: 'WK-AUR-002', project: eduProject, name: 'Sanitation Block', cost: 25, status: 'unassigned' });
  const wkEdu3 = await workItem({
    code: 'WK-AUR-003', project: eduProject, name: 'Library Building', cost: 15,
    status: 'in_progress', officer: users.fieldOfficerEdu,
    progress: { percent: 40, verified: true, submittedDaysAgo: 7, note: 'Library building foundation and structure 40% complete', lat: 19.878, long: 75.345 },
  });

  const wkHealth1 = await workItem({
    code: 'WK-SOL-001', project: healthProject, name: 'Primary Health Centre Construction', cost: 55,
    status: 'completed', officer: users.fieldOfficerHealth,
    progress: { percent: 100, verified: true, submittedDaysAgo: 13, note: 'Primary Health Centre construction complete', lat: 17.66, long: 75.907 },
  });
  await workItem({ code: 'WK-SOL-002', project: healthProject, name: 'District Hospital Ward Expansion', cost: 35, status: 'unassigned' });

  const wkSatara1 = await workItem({
    code: 'WK-SAT-001', project: sataraProject, name: 'Highway Widening — Km 0-15', cost: 55,
    status: 'in_progress', officer: users.fieldOfficerPwd2, vendor: vendorBom,
    progress: { percent: 70, verified: true, submittedDaysAgo: 5, note: 'Widening and shoulder work 70% complete on Km 0-15 stretch', lat: 17.681, long: 74.019 },
  });
  await workItem({ code: 'WK-SAT-002', project: sataraProject, name: 'Highway Widening — Km 15-30', cost: 40, status: 'unassigned', vendor: vendorBom });

  await workItem({
    code: 'WK-AMR-001', project: amravatiProject, name: 'Canal Lining — Section A', cost: 50,
    status: 'in_progress', officer: users.fieldOfficerWater, vendor: vendorKonkan,
    progress: { percent: 45, verified: true, submittedDaysAgo: 6, note: 'Canal lining Section A 45% complete', lat: 20.938, long: 77.780 },
  });
  await workItem({ code: 'WK-AMR-002', project: amravatiProject, name: 'Canal Lining — Section B', cost: 35, status: 'unassigned' });

  const wkThane1 = await workItem({
    code: 'WK-THN-001', project: thaneProject, name: 'Smart Road Signal Network', cost: 60,
    status: 'completed', officer: users.fieldOfficerUrban2, vendor: vendorVidarbha,
    progress: { percent: 100, verified: true, submittedDaysAgo: 10, note: 'Smart signal network installed and commissioned across pilot corridor', lat: 19.219, long: 72.978 },
  });
  await workItem({ code: 'WK-THN-002', project: thaneProject, name: 'Smart Road Lighting Retrofit', cost: 45, status: 'unassigned', vendor: vendorVidarbha });

  // --- Fund demands: every FundDemandStatus represented at least once ---

  async function fundDemand(opts: {
    code: string;
    workItem: { id: string };
    raisedBy: { id: string };
    amount: number;
    eligible: number;
    status: 'checker' | 'finance' | 'approver' | 'released' | 'rejected' | 'queried';
    createdDaysAgo: number;
    attachBill?: boolean;
    actions: { stage: 'maker' | 'checker' | 'finance' | 'approver'; officer: { id: string }; action: string; remarks: string; daysAgo: number }[];
  }) {
    const demand = await prisma.fundDemand.create({
      data: {
        demandCode: opts.code,
        workItemId: opts.workItem.id,
        raisedById: opts.raisedBy.id,
        demandAmount: opts.amount * CR,
        eligibleDemandAmount: opts.eligible * CR,
        status: opts.status,
        createdAt: daysAgo(opts.createdDaysAgo),
        actions: {
          create: opts.actions.map((a) => ({
            stage: a.stage,
            officerId: a.officer.id,
            action: a.action as never,
            remarks: a.remarks,
            timestamp: daysAgo(a.daysAgo),
          })),
        },
      },
    });
    if (opts.attachBill) {
      await prisma.document.create({
        data: {
          fileUrl: '/uploads/demo-bill.pdf',
          fileName: `vendor-bill-${opts.code}.pdf`,
          documentType: 'bill_invoice',
          uploadedById: opts.raisedBy.id,
          fundDemandId: demand.id,
        },
      });
    }
  }

  // 1. RELEASED — Rural (Kolhapur)
  await fundDemand({
    code: 'FD-2026-00001', workItem: wkRural1, raisedBy: users.fieldOfficerRural, amount: 60, eligible: 70, status: 'released', createdDaysAgo: 13, attachBill: true,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerRural, action: 'submitted', remarks: 'Cluster A complete — final demand raised.', daysAgo: 13 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Completion confirmed on site visit.', daysAgo: 11 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Within scheme budget. Cleared.', daysAgo: 9 },
      { stage: 'approver', officer: users.approver, action: 'approved', remarks: 'Approved for release.', daysAgo: 7 },
    ],
  });

  // 2. RELEASED — PWD (Nashik)
  await fundDemand({
    code: 'FD-2026-00002', workItem: wkPwd1, raisedBy: users.fieldOfficerPwd2, amount: 50, eligible: 55, status: 'released', createdDaysAgo: 11, attachBill: true,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerPwd2, action: 'submitted', remarks: 'Segment A paving complete — demand raised.', daysAgo: 11 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Verified against progress log and photos.', daysAgo: 9 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Budget available. Compliant.', daysAgo: 6 },
      { stage: 'approver', officer: users.approver, action: 'approved', remarks: 'Approved for release.', daysAgo: 4 },
    ],
  });

  // 3. CHECKER stage — PWD (Nashik Segment B)
  await fundDemand({
    code: 'FD-2026-00003', workItem: wkPwd2, raisedBy: users.fieldOfficerPwd2, amount: 25, eligible: 29.25, status: 'checker', createdDaysAgo: 1,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerPwd2, action: 'submitted', remarks: 'Segment B drainage 65% verified — raising demand.', daysAgo: 1 },
    ],
  });

  // 4. FINANCE stage — Water (Pune Pipeline)
  await fundDemand({
    code: 'FD-2026-00004', workItem: wkWater1, raisedBy: users.fieldOfficerWater, amount: 28, eligible: 30, status: 'finance', createdDaysAgo: 3,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerWater, action: 'submitted', remarks: 'Pipeline laying 50% complete — demand raised.', daysAgo: 3 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Site progress matches geo-tagged evidence.', daysAgo: 2 },
    ],
  });

  // 5. RELEASED — Water (Pune Overhead Tank)
  await fundDemand({
    code: 'FD-2026-00005', workItem: wkWater3, raisedBy: users.fieldOfficerWater, amount: 18, eligible: 20, status: 'released', createdDaysAgo: 8,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerWater, action: 'submitted', remarks: 'Overhead tank complete — final demand.', daysAgo: 8 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Confirmed complete.', daysAgo: 6 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Cleared.', daysAgo: 4 },
      { stage: 'approver', officer: users.approver, action: 'approved', remarks: 'Released.', daysAgo: 2 },
    ],
  });

  // 6. APPROVER stage — Urban (Nagpur North Zone)
  await fundDemand({
    code: 'FD-2026-00006', workItem: wkUrban1, raisedBy: users.fieldOfficerUrban2, amount: 55, eligible: 56, status: 'approver', createdDaysAgo: 5,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerUrban2, action: 'submitted', remarks: 'North Zone drain 80% complete — demand raised.', daysAgo: 5 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Verified against progress log and photos.', daysAgo: 4 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Budget available under Nagar Vikas Yojna. Compliant.', daysAgo: 3 },
    ],
  });

  // 7. REJECTED — Urban (Nagpur South Zone)
  await fundDemand({
    code: 'FD-2026-00007', workItem: wkUrban2, raisedBy: users.fieldOfficerUrban2, amount: 8, eligible: 8, status: 'rejected', createdDaysAgo: 4,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerUrban2, action: 'submitted', remarks: 'South Zone excavation 20% complete — demand raised.', daysAgo: 4 },
      { stage: 'checker', officer: users.checker, action: 'rejected', remarks: 'Progress percentage does not match site inspection photos — resubmit with updated geo-tagged evidence.', daysAgo: 3 },
    ],
  });

  // 8. RELEASED — Education (Aurangabad classroom block)
  await fundDemand({
    code: 'FD-2026-00008', workItem: wkEdu1, raisedBy: users.fieldOfficerEdu, amount: 45, eligible: 50, status: 'released', createdDaysAgo: 10,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerEdu, action: 'submitted', remarks: 'Classroom block complete — final demand raised.', daysAgo: 10 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Completion confirmed on site visit.', daysAgo: 8 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Final payment within scheme budget. Cleared.', daysAgo: 6 },
      { stage: 'approver', officer: users.approver, action: 'approved', remarks: 'Approved for release. Funds disbursed.', daysAgo: 4 },
    ],
  });

  // 9. QUERIED — Education (Aurangabad library)
  await fundDemand({
    code: 'FD-2026-00009', workItem: wkEdu3, raisedBy: users.fieldOfficerEdu, amount: 6, eligible: 6, status: 'queried', createdDaysAgo: 6,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerEdu, action: 'submitted', remarks: 'Library building 40% complete — demand raised.', daysAgo: 6 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Verified against progress log and photos.', daysAgo: 5 },
      { stage: 'finance', officer: users.finance, action: 'queried', remarks: 'Please attach the vendor invoice breakdown before this can be cleared — amount looks fine but documentation is incomplete.', daysAgo: 3 },
    ],
  });

  // 10. RELEASED — Health (Solapur PHC)
  await fundDemand({
    code: 'FD-2026-00010', workItem: wkHealth1, raisedBy: users.fieldOfficerHealth, amount: 48, eligible: 55, status: 'released', createdDaysAgo: 15,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerHealth, action: 'submitted', remarks: 'Primary Health Centre complete — final demand raised.', daysAgo: 15 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Completion confirmed on site visit.', daysAgo: 12 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Within scheme budget. Cleared.', daysAgo: 9 },
      { stage: 'approver', officer: users.approver, action: 'approved', remarks: 'Approved for release.', daysAgo: 6 },
    ],
  });

  // 11. CHECKER stage — PWD (Satara Highway)
  await fundDemand({
    code: 'FD-2026-00011', workItem: wkSatara1, raisedBy: users.fieldOfficerPwd2, amount: 30, eligible: 38.5, status: 'checker', createdDaysAgo: 2,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerPwd2, action: 'submitted', remarks: 'Km 0-15 widening 70% complete — raising demand.', daysAgo: 2 },
    ],
  });

  // 12. RELEASED — Urban (Thane Smart Roads)
  await fundDemand({
    code: 'FD-2026-00012', workItem: wkThane1, raisedBy: users.fieldOfficerUrban2, amount: 52, eligible: 60, status: 'released', createdDaysAgo: 9, attachBill: true,
    actions: [
      { stage: 'maker', officer: users.fieldOfficerUrban2, action: 'submitted', remarks: 'Smart signal network complete — final demand raised.', daysAgo: 9 },
      { stage: 'checker', officer: users.checker, action: 'verified', remarks: 'Commissioning confirmed on site visit.', daysAgo: 7 },
      { stage: 'finance', officer: users.finance, action: 'validated', remarks: 'Within scheme budget. Cleared.', daysAgo: 5 },
      { stage: 'approver', officer: users.approver, action: 'approved', remarks: 'Approved for release.', daysAgo: 3 },
    ],
  });

  console.log('Seed complete.');
  console.log('\nDemo credentials (password: password123, OTP: 123456):');
  console.log('  PMU Admin:                 PMU-MH-00001');
  console.log('  Department Officer (PWD):  DOE-MH-04471');
  console.log('  Field Officer (Rural Dev): FO-MH-10233 — M. Jadhav');
  console.log('  Field Officer (Health):    FO-MH-10238 — A. Pawar');
  console.log('  Checker:                   CHK-MH-20001');
  console.log('  Finance Officer:           FIN-MH-30001');
  console.log('  Approver:                  APP-MH-40001');
  console.log('  Auditor:                   AUD-MH-50001');
  console.log('  System Admin:              ADM-MH-90001');
  console.log('\nFund demands seeded across every stage: checker, finance, approver, queried, released, rejected.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

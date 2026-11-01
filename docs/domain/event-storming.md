# Event Storming – Pinball Museum

> Generated from `docs/domain/events.yaml` – **do not edit manually**.

Legend: 🟧 Event · 🟦 Command · 🟪 Policy · 🟩 Read model · 🟨 Actor · 🩷 External system · 🟥 Hotspot · ⭐ Pivotal event

## Big Picture

```mermaid
flowchart LR
    subgraph BC_Repair["Repair"]
        CMD_ReportProblem["Report problem"]:::cmd
        CMD_RecordDefect["Record defect"]:::cmd
        CMD_LinkProblemReportToDefect["Link problem report to defect"]:::cmd
        CMD_ResolveProblemOnTheSpot["Resolve problem on the spot"]:::cmd
        CMD_DismissProblemReport["Dismiss problem report"]:::cmd
        CMD_PrioritizeDefect["Prioritize defect"]:::cmd
        CMD_ChangeDefectDetails["Change defect details"]:::cmd
        CMD_ClaimDefect["Claim defect"]:::cmd
        CMD_ReleaseClaim["Release claim"]:::cmd
        CMD_LogWork["Log work"]:::cmd
        CMD_PutDefectOnHold["Put defect on hold"]:::cmd
        CMD_ResumeDefect["Resume defect"]:::cmd
        CMD_ResolveDefect["Resolve defect"]:::cmd
        CMD_ReopenDefect["Reopen defect"]:::cmd
        CMD_CloseDefectOnRetirement["Close defect on retirement"]:::cmd
        EVT_ProblemReported["⭐ Problem reported"]:::evt
        EVT_DefectRecorded["⭐ Defect recorded"]:::evt
        EVT_ProblemReportLinkedToDefect["Problem report linked to defect"]:::evt
        EVT_ProblemResolvedOnTheSpot["Problem resolved on the spot"]:::evt
        EVT_ProblemReportDismissed["Problem report dismissed"]:::evt
        EVT_DefectPrioritized["Defect prioritized"]:::evt
        EVT_DefectDetailsChanged["Defect details changed"]:::evt
        EVT_DefectClaimed["Defect claimed"]:::evt
        EVT_DefectClaimReleased["Defect claim released"]:::evt
        EVT_WorkLogged["Work logged"]:::evt
        EVT_DefectPutOnHold["Defect put on hold"]:::evt
        EVT_DefectResumed["Defect resumed"]:::evt
        EVT_DefectResolved["⭐ Defect resolved"]:::evt
        EVT_DefectReopened["Defect reopened"]:::evt
        EVT_DefectClosedOnRetirement["Defect closed on retirement"]:::evt
    end
    subgraph BC_Collection["Collection"]
        CMD_CreateMachineModel["Create machine model"]:::cmd
        CMD_RegisterMachine["Register machine"]:::cmd
        CMD_ChangeMachineStatus["Change machine status"]:::cmd
        CMD_MoveMachine["Move machine"]:::cmd
        CMD_CorrectMachineDetails["Correct machine details"]:::cmd
        CMD_CorrectMachineModel["Correct machine model"]:::cmd
        CMD_AttachFile["Attach file"]:::cmd
        CMD_RemoveFile["Remove file"]:::cmd
        CMD_RetireMachine["Retire machine"]:::cmd
        CMD_ChangeMuseumDetails["Change museum details"]:::cmd
        CMD_ReplaceLogo["Replace logo"]:::cmd
        CMD_RemoveLogo["Remove logo"]:::cmd
        CMD_ChangeLegalTexts["Change legal texts"]:::cmd
        EVT_MachineModelCreated["Machine model created"]:::evt
        EVT_MachineRegistered["⭐ Machine registered"]:::evt
        EVT_MachineStatusChanged["⭐ Machine status changed"]:::evt
        EVT_MachineMoved["Machine moved"]:::evt
        EVT_MachineDetailsCorrected["Machine details corrected"]:::evt
        EVT_MachineModelCorrected["Machine model corrected"]:::evt
        EVT_FileAttached["File attached"]:::evt
        EVT_FileRemoved["File removed"]:::evt
        EVT_MachineRetired["⭐ Machine retired"]:::evt
        EVT_MuseumDetailsChanged["Museum details changed"]:::evt
        EVT_LogoReplaced["Logo replaced"]:::evt
        EVT_LogoRemoved["Logo removed"]:::evt
        EVT_LegalTextsChanged["Legal texts changed"]:::evt
    end
    subgraph BC_Maintenance["Maintenance"]
        CMD_ChangeMaintenancePlan["Change maintenance plan"]:::cmd
        CMD_ChangeMachinesOfMaintenanceTask["Change machines of maintenance task"]:::cmd
        CMD_RecordMaintenance["Record maintenance"]:::cmd
        EVT_MaintenancePlanChanged["Maintenance plan changed"]:::evt
        EVT_MachinesOfMaintenanceTaskChanged["Machines of maintenance task changed"]:::evt
        EVT_MaintenanceTaskDue["⭐ Maintenance task due"]:::evt
        EVT_MaintenanceTaskOverdue["Maintenance task overdue"]:::evt
        EVT_MaintenanceRecorded["Maintenance recorded"]:::evt
    end
    subgraph BC_AiAssistance["AI assistance"]
        CMD_ChangeAiSettings["Change AI settings"]:::cmd
        CMD_IndexFileForAi["Index file for AI"]:::cmd
        CMD_RemoveFileFromAiIndex["Remove file from AI index"]:::cmd
        CMD_RequestAiAssessment["Request AI assessment"]:::cmd
        CMD_WriteAiAssessment["Write AI assessment"]:::cmd
        EVT_AiSettingsChanged["AI settings changed"]:::evt
        EVT_FileIndexedForAi["File indexed for AI"]:::evt
        EVT_FileIndexingFailed["File indexing failed"]:::evt
        EVT_FileLeftAiIndex["File left the AI index"]:::evt
        EVT_AiWorkLeftUnfinished["AI work left unfinished"]:::evt
        EVT_AiAssessmentRequested["⭐ AI assessment requested"]:::evt
        EVT_AiAssessmentWritten["AI assessment written"]:::evt
        EVT_AiAssessmentFailed["AI assessment failed"]:::evt
    end
    ACT_Visitor(["Visitor"]):::act
    ACT_Helper(["Helper"]):::act
    ACT_Technician(["Technician"]):::act
    ACT_TeamMember(["Team member"]):::act
    EXT_OpenRouter[["OpenRouter"]]:::ext
    POL_LinkReopensResolvedDefect{{"Linking to a resolved defect reopens it"}}:::pol
    POL_RetirementClosesDefects{{"Retirement closes open defects"}}:::pol
    POL_RetirementDismissesProblemReports{{"Retirement dismisses untriaged problem reports"}}:::pol
    POL_RegistrationAppliesChosenMaintenanceTasks{{"Registering a machine applies the chosen maintenance tasks"}}:::pol
    POL_AiIndexFollowsTheSettings{{"The AI index follows the AI settings"}}:::pol
    POL_AttachedFileIsIndexedForAi{{"An attached file is indexed for AI"}}:::pol
    POL_RemovedFileLeavesAiIndex{{"A removed file leaves the AI index"}}:::pol
    POL_RequestedAiAssessmentIsWritten{{"A requested AI assessment is written"}}:::pol
    POL_UnfinishedAiWorkFails{{"Unfinished AI work fails as broken off"}}:::pol
    POL_TriageProblemReports{{"New problem reports are triaged"}}:::pol
    POL_DefectMayChangeMachineStatus{{"A new or reopened defect may change the machine status"}}:::pol
    POL_ResolvedDefectsReturnMachineToPlay{{"Machines without open defects return to play"}}:::pol
    POL_DueMaintenanceIsCarriedOut{{"Due maintenance is carried out"}}:::pol
    POL_MaintenanceFindingIsReported{{"Findings during maintenance are reported"}}:::pol
    RM_VisitorMachinePage[("Visitor machine page")]:::rm
    RM_TriageList[("Triage list")]:::rm
    RM_OpenDefects[("Open defects")]:::rm
    RM_MachineOverview[("Machine overview")]:::rm
    RM_MachineRecord[("Machine record")]:::rm
    RM_DueMaintenance[("Due maintenance")]:::rm
    RM_MaintenancePlan[("Maintenance plan")]:::rm
    RM_MachineChoiceForMaintenanceTask[("Machine choice for a maintenance task")]:::rm
    RM_MaintenanceTaskChoiceForMachine[("Maintenance task choice for a machine")]:::rm
    RM_TechnicianDashboard[("Technician dashboard")]:::rm
    RM_HelperDashboard[("Helper dashboard")]:::rm
    RM_RepairTimes[("Repair times")]:::rm
    RM_WelcomePage[("Welcome page")]:::rm
    RM_LegalPage[("Legal page")]:::rm
    RM_MuseumSettings[("Museum settings")]:::rm
    RM_AiSettings[("AI settings")]:::rm
    RM_DefectAiAssessments[("AI assessments of a defect")]:::rm
    ACT_Visitor --> CMD_ReportProblem
    CMD_ReportProblem --> EVT_ProblemReported
    CMD_ReportProblem --> EVT_DefectRecorded
    CMD_ReportProblem --> EVT_ProblemReportLinkedToDefect
    CMD_ReportProblem --> EVT_ProblemResolvedOnTheSpot
    ACT_Technician --> CMD_RecordDefect
    CMD_RecordDefect --> EVT_DefectRecorded
    ACT_Technician --> CMD_LinkProblemReportToDefect
    CMD_LinkProblemReportToDefect --> EVT_ProblemReportLinkedToDefect
    ACT_TeamMember --> CMD_ResolveProblemOnTheSpot
    CMD_ResolveProblemOnTheSpot --> EVT_ProblemResolvedOnTheSpot
    ACT_Technician --> CMD_DismissProblemReport
    CMD_DismissProblemReport --> EVT_ProblemReportDismissed
    ACT_Technician --> CMD_PrioritizeDefect
    CMD_PrioritizeDefect --> EVT_DefectPrioritized
    ACT_Technician --> CMD_ChangeDefectDetails
    CMD_ChangeDefectDetails --> EVT_DefectDetailsChanged
    CMD_ChangeDefectDetails --> EVT_DefectClaimReleased
    ACT_TeamMember --> CMD_ClaimDefect
    CMD_ClaimDefect --> EVT_DefectClaimed
    ACT_TeamMember --> CMD_ReleaseClaim
    CMD_ReleaseClaim --> EVT_DefectClaimReleased
    ACT_TeamMember --> CMD_LogWork
    CMD_LogWork --> EVT_WorkLogged
    ACT_TeamMember --> CMD_PutDefectOnHold
    CMD_PutDefectOnHold --> EVT_DefectPutOnHold
    ACT_TeamMember --> CMD_ResumeDefect
    CMD_ResumeDefect --> EVT_DefectResumed
    ACT_TeamMember --> CMD_ResolveDefect
    CMD_ResolveDefect --> EVT_DefectResolved
    ACT_TeamMember --> CMD_ReopenDefect
    CMD_ReopenDefect --> EVT_DefectReopened
    ACT_Technician --> CMD_CreateMachineModel
    CMD_CreateMachineModel --> EVT_MachineModelCreated
    ACT_Technician --> CMD_RegisterMachine
    CMD_RegisterMachine --> EVT_MachineRegistered
    ACT_Technician --> CMD_ChangeMachineStatus
    CMD_ChangeMachineStatus --> EVT_MachineStatusChanged
    ACT_TeamMember --> CMD_MoveMachine
    CMD_MoveMachine --> EVT_MachineMoved
    ACT_Technician --> CMD_CorrectMachineDetails
    CMD_CorrectMachineDetails --> EVT_MachineDetailsCorrected
    ACT_Technician --> CMD_CorrectMachineModel
    CMD_CorrectMachineModel --> EVT_MachineModelCorrected
    ACT_TeamMember --> CMD_AttachFile
    CMD_AttachFile --> EVT_FileAttached
    ACT_Technician --> CMD_RemoveFile
    CMD_RemoveFile --> EVT_FileRemoved
    ACT_Technician --> CMD_RetireMachine
    CMD_RetireMachine --> EVT_MachineRetired
    CMD_CloseDefectOnRetirement --> EVT_DefectClosedOnRetirement
    ACT_Technician --> CMD_ChangeMaintenancePlan
    CMD_ChangeMaintenancePlan --> EVT_MaintenancePlanChanged
    CMD_ChangeMaintenancePlan --> EVT_MachinesOfMaintenanceTaskChanged
    ACT_Technician --> CMD_ChangeMachinesOfMaintenanceTask
    CMD_ChangeMachinesOfMaintenanceTask --> EVT_MachinesOfMaintenanceTaskChanged
    ACT_TeamMember --> CMD_RecordMaintenance
    CMD_RecordMaintenance --> EVT_MaintenanceRecorded
    ACT_Technician --> CMD_ChangeMuseumDetails
    CMD_ChangeMuseumDetails --> EVT_MuseumDetailsChanged
    ACT_Technician --> CMD_ReplaceLogo
    CMD_ReplaceLogo --> EVT_LogoReplaced
    ACT_Technician --> CMD_RemoveLogo
    CMD_RemoveLogo --> EVT_LogoRemoved
    ACT_Technician --> CMD_ChangeLegalTexts
    CMD_ChangeLegalTexts --> EVT_LegalTextsChanged
    ACT_Technician --> CMD_ChangeAiSettings
    CMD_ChangeAiSettings --> EVT_AiSettingsChanged
    ACT_Technician --> CMD_IndexFileForAi
    CMD_IndexFileForAi --> EVT_FileIndexedForAi
    CMD_IndexFileForAi --> EVT_FileIndexingFailed
    CMD_RemoveFileFromAiIndex --> EVT_FileLeftAiIndex
    ACT_TeamMember --> CMD_RequestAiAssessment
    CMD_RequestAiAssessment --> EVT_AiAssessmentRequested
    CMD_WriteAiAssessment --> EVT_AiAssessmentWritten
    CMD_WriteAiAssessment --> EVT_AiAssessmentFailed
    EVT_ProblemReportLinkedToDefect --> POL_LinkReopensResolvedDefect
    POL_LinkReopensResolvedDefect --> CMD_ReopenDefect
    EVT_MachineRetired --> POL_RetirementClosesDefects
    POL_RetirementClosesDefects --> CMD_CloseDefectOnRetirement
    EVT_MachineRetired --> POL_RetirementDismissesProblemReports
    POL_RetirementDismissesProblemReports --> CMD_DismissProblemReport
    EVT_MachineRegistered --> POL_RegistrationAppliesChosenMaintenanceTasks
    POL_RegistrationAppliesChosenMaintenanceTasks --> CMD_ChangeMachinesOfMaintenanceTask
    EVT_AiSettingsChanged --> POL_AiIndexFollowsTheSettings
    POL_AiIndexFollowsTheSettings --> CMD_IndexFileForAi
    EVT_FileAttached --> POL_AttachedFileIsIndexedForAi
    POL_AttachedFileIsIndexedForAi --> CMD_IndexFileForAi
    EVT_FileRemoved --> POL_RemovedFileLeavesAiIndex
    POL_RemovedFileLeavesAiIndex --> CMD_RemoveFileFromAiIndex
    EVT_AiAssessmentRequested --> POL_RequestedAiAssessmentIsWritten
    POL_RequestedAiAssessmentIsWritten --> CMD_WriteAiAssessment
    EVT_AiWorkLeftUnfinished --> POL_UnfinishedAiWorkFails
    POL_UnfinishedAiWorkFails --> CMD_IndexFileForAi
    POL_UnfinishedAiWorkFails --> CMD_WriteAiAssessment
    EVT_ProblemReported --> POL_TriageProblemReports
    POL_TriageProblemReports --> CMD_RecordDefect
    POL_TriageProblemReports --> CMD_LinkProblemReportToDefect
    POL_TriageProblemReports --> CMD_ResolveProblemOnTheSpot
    POL_TriageProblemReports --> CMD_DismissProblemReport
    EVT_DefectRecorded --> POL_DefectMayChangeMachineStatus
    EVT_DefectReopened --> POL_DefectMayChangeMachineStatus
    POL_DefectMayChangeMachineStatus --> CMD_ChangeMachineStatus
    EVT_DefectResolved --> POL_ResolvedDefectsReturnMachineToPlay
    POL_ResolvedDefectsReturnMachineToPlay --> CMD_ChangeMachineStatus
    EVT_MaintenanceTaskDue --> POL_DueMaintenanceIsCarriedOut
    EVT_MaintenanceTaskOverdue --> POL_DueMaintenanceIsCarriedOut
    POL_DueMaintenanceIsCarriedOut --> CMD_RecordMaintenance
    EVT_MaintenanceRecorded --> POL_MaintenanceFindingIsReported
    POL_MaintenanceFindingIsReported --> CMD_ReportProblem
    EVT_MachineModelCreated -.-> RM_VisitorMachinePage
    EVT_MachineRegistered -.-> RM_VisitorMachinePage
    EVT_MachineStatusChanged -.-> RM_VisitorMachinePage
    EVT_MachineRetired -.-> RM_VisitorMachinePage
    EVT_ProblemReported -.-> RM_VisitorMachinePage
    EVT_DefectRecorded -.-> RM_VisitorMachinePage
    EVT_ProblemReportLinkedToDefect -.-> RM_VisitorMachinePage
    EVT_ProblemResolvedOnTheSpot -.-> RM_VisitorMachinePage
    EVT_ProblemReportDismissed -.-> RM_VisitorMachinePage
    EVT_DefectResolved -.-> RM_VisitorMachinePage
    EVT_DefectReopened -.-> RM_VisitorMachinePage
    EVT_DefectClosedOnRetirement -.-> RM_VisitorMachinePage
    EVT_MachineModelCorrected -.-> RM_VisitorMachinePage
    EVT_DefectDetailsChanged -.-> RM_VisitorMachinePage
    RM_VisitorMachinePage -.-> ACT_Visitor
    EVT_ProblemReported -.-> RM_TriageList
    EVT_DefectRecorded -.-> RM_TriageList
    EVT_ProblemReportLinkedToDefect -.-> RM_TriageList
    EVT_ProblemResolvedOnTheSpot -.-> RM_TriageList
    EVT_ProblemReportDismissed -.-> RM_TriageList
    EVT_MachineRetired -.-> RM_TriageList
    EVT_DefectDetailsChanged -.-> RM_TriageList
    RM_TriageList -.-> ACT_Technician
    RM_TriageList -.-> ACT_Helper
    EVT_DefectRecorded -.-> RM_OpenDefects
    EVT_DefectPrioritized -.-> RM_OpenDefects
    EVT_DefectClaimed -.-> RM_OpenDefects
    EVT_DefectClaimReleased -.-> RM_OpenDefects
    EVT_WorkLogged -.-> RM_OpenDefects
    EVT_DefectPutOnHold -.-> RM_OpenDefects
    EVT_DefectResumed -.-> RM_OpenDefects
    EVT_DefectResolved -.-> RM_OpenDefects
    EVT_DefectReopened -.-> RM_OpenDefects
    EVT_DefectClosedOnRetirement -.-> RM_OpenDefects
    EVT_ProblemReportLinkedToDefect -.-> RM_OpenDefects
    EVT_DefectDetailsChanged -.-> RM_OpenDefects
    RM_OpenDefects -.-> ACT_TeamMember
    EVT_MachineModelCreated -.-> RM_MachineOverview
    EVT_MachineRegistered -.-> RM_MachineOverview
    EVT_MachineStatusChanged -.-> RM_MachineOverview
    EVT_MachineRetired -.-> RM_MachineOverview
    EVT_DefectRecorded -.-> RM_MachineOverview
    EVT_DefectResolved -.-> RM_MachineOverview
    EVT_DefectReopened -.-> RM_MachineOverview
    EVT_DefectClosedOnRetirement -.-> RM_MachineOverview
    EVT_MaintenanceTaskOverdue -.-> RM_MachineOverview
    EVT_MaintenanceRecorded -.-> RM_MachineOverview
    EVT_MachineMoved -.-> RM_MachineOverview
    EVT_MachineDetailsCorrected -.-> RM_MachineOverview
    EVT_MachineModelCorrected -.-> RM_MachineOverview
    RM_MachineOverview -.-> ACT_TeamMember
    EVT_MachineModelCreated -.-> RM_MachineRecord
    EVT_MachineRegistered -.-> RM_MachineRecord
    EVT_MachineStatusChanged -.-> RM_MachineRecord
    EVT_MachineRetired -.-> RM_MachineRecord
    EVT_FileAttached -.-> RM_MachineRecord
    EVT_FileRemoved -.-> RM_MachineRecord
    EVT_DefectRecorded -.-> RM_MachineRecord
    EVT_WorkLogged -.-> RM_MachineRecord
    EVT_DefectResolved -.-> RM_MachineRecord
    EVT_DefectReopened -.-> RM_MachineRecord
    EVT_DefectPutOnHold -.-> RM_MachineRecord
    EVT_DefectResumed -.-> RM_MachineRecord
    EVT_DefectClosedOnRetirement -.-> RM_MachineRecord
    EVT_ProblemResolvedOnTheSpot -.-> RM_MachineRecord
    EVT_MaintenanceRecorded -.-> RM_MachineRecord
    EVT_MaintenanceTaskDue -.-> RM_MachineRecord
    EVT_MaintenanceTaskOverdue -.-> RM_MachineRecord
    EVT_MachineMoved -.-> RM_MachineRecord
    EVT_MachineDetailsCorrected -.-> RM_MachineRecord
    EVT_MachineModelCorrected -.-> RM_MachineRecord
    EVT_DefectDetailsChanged -.-> RM_MachineRecord
    EVT_MaintenancePlanChanged -.-> RM_MachineRecord
    EVT_MachinesOfMaintenanceTaskChanged -.-> RM_MachineRecord
    EVT_FileIndexingFailed -.-> RM_MachineRecord
    EVT_FileIndexedForAi -.-> RM_MachineRecord
    EVT_AiAssessmentWritten -.-> RM_MachineRecord
    EVT_AiAssessmentFailed -.-> RM_MachineRecord
    RM_MachineRecord -.-> ACT_TeamMember
    EVT_MaintenancePlanChanged -.-> RM_DueMaintenance
    EVT_MachinesOfMaintenanceTaskChanged -.-> RM_DueMaintenance
    EVT_MaintenanceTaskDue -.-> RM_DueMaintenance
    EVT_MaintenanceTaskOverdue -.-> RM_DueMaintenance
    EVT_MaintenanceRecorded -.-> RM_DueMaintenance
    EVT_MachineRegistered -.-> RM_DueMaintenance
    EVT_MachineStatusChanged -.-> RM_DueMaintenance
    EVT_MachineRetired -.-> RM_DueMaintenance
    EVT_MachineMoved -.-> RM_DueMaintenance
    EVT_MachineModelCorrected -.-> RM_DueMaintenance
    RM_DueMaintenance -.-> ACT_TeamMember
    EVT_MaintenancePlanChanged -.-> RM_MaintenancePlan
    EVT_MachinesOfMaintenanceTaskChanged -.-> RM_MaintenancePlan
    EVT_MachineRetired -.-> RM_MaintenancePlan
    RM_MaintenancePlan -.-> ACT_Technician
    EVT_MachineModelCreated -.-> RM_MachineChoiceForMaintenanceTask
    EVT_MachineRegistered -.-> RM_MachineChoiceForMaintenanceTask
    EVT_MachineRetired -.-> RM_MachineChoiceForMaintenanceTask
    EVT_MachineModelCorrected -.-> RM_MachineChoiceForMaintenanceTask
    EVT_MachinesOfMaintenanceTaskChanged -.-> RM_MachineChoiceForMaintenanceTask
    RM_MachineChoiceForMaintenanceTask -.-> ACT_Technician
    EVT_MaintenancePlanChanged -.-> RM_MaintenanceTaskChoiceForMachine
    EVT_MachinesOfMaintenanceTaskChanged -.-> RM_MaintenanceTaskChoiceForMachine
    EVT_MachineModelCreated -.-> RM_MaintenanceTaskChoiceForMachine
    EVT_MachineRegistered -.-> RM_MaintenanceTaskChoiceForMachine
    EVT_MachineRetired -.-> RM_MaintenanceTaskChoiceForMachine
    EVT_MachineModelCorrected -.-> RM_MaintenanceTaskChoiceForMachine
    RM_MaintenanceTaskChoiceForMachine -.-> ACT_Technician
    EVT_ProblemReported -.-> RM_TechnicianDashboard
    EVT_DefectRecorded -.-> RM_TechnicianDashboard
    EVT_ProblemReportLinkedToDefect -.-> RM_TechnicianDashboard
    EVT_ProblemResolvedOnTheSpot -.-> RM_TechnicianDashboard
    EVT_ProblemReportDismissed -.-> RM_TechnicianDashboard
    EVT_MachineStatusChanged -.-> RM_TechnicianDashboard
    EVT_DefectResolved -.-> RM_TechnicianDashboard
    EVT_DefectReopened -.-> RM_TechnicianDashboard
    EVT_DefectClaimed -.-> RM_TechnicianDashboard
    EVT_WorkLogged -.-> RM_TechnicianDashboard
    EVT_MaintenanceTaskOverdue -.-> RM_TechnicianDashboard
    EVT_MaintenanceRecorded -.-> RM_TechnicianDashboard
    RM_TechnicianDashboard -.-> ACT_Technician
    EVT_DefectRecorded -.-> RM_HelperDashboard
    EVT_DefectClaimed -.-> RM_HelperDashboard
    EVT_DefectClaimReleased -.-> RM_HelperDashboard
    EVT_WorkLogged -.-> RM_HelperDashboard
    EVT_DefectResolved -.-> RM_HelperDashboard
    EVT_DefectReopened -.-> RM_HelperDashboard
    EVT_MaintenanceTaskDue -.-> RM_HelperDashboard
    EVT_MaintenanceTaskOverdue -.-> RM_HelperDashboard
    EVT_MaintenanceRecorded -.-> RM_HelperDashboard
    EVT_DefectDetailsChanged -.-> RM_HelperDashboard
    RM_HelperDashboard -.-> ACT_Helper
    EVT_ProblemReported -.-> RM_RepairTimes
    EVT_DefectRecorded -.-> RM_RepairTimes
    EVT_ProblemReportLinkedToDefect -.-> RM_RepairTimes
    EVT_WorkLogged -.-> RM_RepairTimes
    EVT_DefectResolved -.-> RM_RepairTimes
    EVT_DefectReopened -.-> RM_RepairTimes
    EVT_DefectClosedOnRetirement -.-> RM_RepairTimes
    RM_RepairTimes -.-> ACT_Technician
    EVT_MuseumDetailsChanged -.-> RM_WelcomePage
    EVT_LogoReplaced -.-> RM_WelcomePage
    EVT_LogoRemoved -.-> RM_WelcomePage
    EVT_LegalTextsChanged -.-> RM_WelcomePage
    EVT_MachineModelCreated -.-> RM_WelcomePage
    EVT_MachineModelCorrected -.-> RM_WelcomePage
    EVT_MachineRegistered -.-> RM_WelcomePage
    EVT_MachineStatusChanged -.-> RM_WelcomePage
    EVT_MachineMoved -.-> RM_WelcomePage
    EVT_MachineDetailsCorrected -.-> RM_WelcomePage
    EVT_MachineRetired -.-> RM_WelcomePage
    RM_WelcomePage -.-> ACT_Visitor
    EVT_LegalTextsChanged -.-> RM_LegalPage
    RM_LegalPage -.-> ACT_Visitor
    EVT_MuseumDetailsChanged -.-> RM_MuseumSettings
    EVT_LogoReplaced -.-> RM_MuseumSettings
    EVT_LogoRemoved -.-> RM_MuseumSettings
    EVT_LegalTextsChanged -.-> RM_MuseumSettings
    RM_MuseumSettings -.-> ACT_Technician
    EVT_AiSettingsChanged -.-> RM_AiSettings
    EVT_FileIndexedForAi -.-> RM_AiSettings
    EVT_FileIndexingFailed -.-> RM_AiSettings
    EVT_FileLeftAiIndex -.-> RM_AiSettings
    EVT_FileAttached -.-> RM_AiSettings
    EVT_FileRemoved -.-> RM_AiSettings
    RM_AiSettings -.-> ACT_Technician
    EVT_AiAssessmentRequested -.-> RM_DefectAiAssessments
    EVT_AiAssessmentWritten -.-> RM_DefectAiAssessments
    EVT_AiAssessmentFailed -.-> RM_DefectAiAssessments
    EVT_DefectResolved -.-> RM_DefectAiAssessments
    EVT_DefectReopened -.-> RM_DefectAiAssessments
    EVT_DefectClosedOnRetirement -.-> RM_DefectAiAssessments
    EVT_DefectDetailsChanged -.-> RM_DefectAiAssessments
    EVT_AiSettingsChanged -.-> RM_DefectAiAssessments
    EVT_FileRemoved -.-> RM_DefectAiAssessments
    RM_DefectAiAssessments -.-> ACT_TeamMember
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

## Flows

### From problem report to defect

Main path shown. Alternative triage outcomes instead of Defect recorded: Problem report linked to defect, Problem resolved on the spot, Problem report dismissed.

```mermaid
flowchart LR
    ACT_Visitor(["Visitor"]):::act
    EVT_ProblemReported["⭐ Problem reported"]:::evt
    ACT_Technician(["Technician"]):::act
    EVT_DefectRecorded["⭐ Defect recorded"]:::evt
    EVT_MachineStatusChanged["⭐ Machine status changed"]:::evt
    ACT_Visitor --> EVT_ProblemReported
    EVT_ProblemReported --> ACT_Technician
    ACT_Technician --> EVT_DefectRecorded
    EVT_DefectRecorded --> EVT_MachineStatusChanged
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

### Repairing a defect

On hold / resumed and work logged may repeat. Reopened leads back to claiming and work. After resolution the technician may return the machine to Playable.

```mermaid
flowchart LR
    EVT_DefectRecorded["⭐ Defect recorded"]:::evt
    EVT_DefectPrioritized["Defect prioritized"]:::evt
    EVT_DefectClaimed["Defect claimed"]:::evt
    EVT_WorkLogged["Work logged"]:::evt
    EVT_DefectPutOnHold["Defect put on hold"]:::evt
    EVT_DefectResumed["Defect resumed"]:::evt
    EVT_DefectResolved["⭐ Defect resolved"]:::evt
    EVT_MachineStatusChanged["⭐ Machine status changed"]:::evt
    EVT_DefectReopened["Defect reopened"]:::evt
    EVT_DefectRecorded --> EVT_DefectPrioritized
    EVT_DefectPrioritized --> EVT_DefectClaimed
    EVT_DefectClaimed --> EVT_WorkLogged
    EVT_WorkLogged --> EVT_DefectPutOnHold
    EVT_DefectPutOnHold --> EVT_DefectResumed
    EVT_DefectResumed --> EVT_DefectResolved
    EVT_DefectResolved --> EVT_MachineStatusChanged
    EVT_MachineStatusChanged --> EVT_DefectReopened
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

### Scheduled maintenance

Repeats per machine and maintenance task. A finding during maintenance becomes a problem report and enters the triage flow.

```mermaid
flowchart LR
    ACT_Technician(["Technician"]):::act
    EVT_MaintenancePlanChanged["Maintenance plan changed"]:::evt
    EVT_MaintenanceTaskDue["⭐ Maintenance task due"]:::evt
    EVT_MaintenanceTaskOverdue["Maintenance task overdue"]:::evt
    ACT_Helper(["Helper"]):::act
    EVT_MaintenanceRecorded["Maintenance recorded"]:::evt
    EVT_ProblemReported["⭐ Problem reported"]:::evt
    ACT_Technician --> EVT_MaintenancePlanChanged
    EVT_MaintenancePlanChanged --> EVT_MaintenanceTaskDue
    EVT_MaintenanceTaskDue --> EVT_MaintenanceTaskOverdue
    EVT_MaintenanceTaskOverdue --> ACT_Helper
    ACT_Helper --> EVT_MaintenanceRecorded
    EVT_MaintenanceRecorded --> EVT_ProblemReported
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

### Machine lifecycle

```mermaid
flowchart LR
    ACT_Technician(["Technician"]):::act
    EVT_MachineModelCreated["Machine model created"]:::evt
    EVT_MachineRegistered["⭐ Machine registered"]:::evt
    EVT_FileAttached["File attached"]:::evt
    EVT_MachineStatusChanged["⭐ Machine status changed"]:::evt
    EVT_MachineRetired["⭐ Machine retired"]:::evt
    EVT_DefectClosedOnRetirement["Defect closed on retirement"]:::evt
    ACT_Technician --> EVT_MachineModelCreated
    EVT_MachineModelCreated --> EVT_MachineRegistered
    EVT_MachineRegistered --> EVT_FileAttached
    EVT_FileAttached --> EVT_MachineStatusChanged
    EVT_MachineStatusChanged --> EVT_MachineRetired
    EVT_MachineRetired --> EVT_DefectClosedOnRetirement
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

### Per-machine maintenance

Feature per-machine-maintenance (2026-10-25). A technician chooses the machines of a maintenance task – when adding it, later on the task or on the machine record, or when registering a machine. The task is due at once on each machine it newly applies to; each machine's interval then runs from its own last done maintenance record, so the work spreads out instead of falling due everywhere on the same day.

```mermaid
flowchart LR
    ACT_Technician(["Technician"]):::act
    EVT_MaintenancePlanChanged["Maintenance plan changed"]:::evt
    EVT_MachinesOfMaintenanceTaskChanged["Machines of maintenance task changed"]:::evt
    EVT_MaintenanceTaskDue["⭐ Maintenance task due"]:::evt
    EVT_MaintenanceTaskOverdue["Maintenance task overdue"]:::evt
    ACT_TeamMember(["Team member"]):::act
    EVT_MaintenanceRecorded["Maintenance recorded"]:::evt
    ACT_Technician --> EVT_MaintenancePlanChanged
    EVT_MaintenancePlanChanged --> EVT_MachinesOfMaintenanceTaskChanged
    EVT_MachinesOfMaintenanceTaskChanged --> EVT_MaintenanceTaskDue
    EVT_MaintenanceTaskDue --> EVT_MaintenanceTaskOverdue
    EVT_MaintenanceTaskOverdue --> ACT_TeamMember
    ACT_TeamMember --> EVT_MaintenanceRecorded
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

### The museum's welcome page

Feature museum-start-page (2026-10-31). A technician sets the museum's name, logo and legal texts and chooses whether the machines on display are listed; a visitor on the welcome page taps a machine and reports a problem on its visitor machine page as from its QR code.

```mermaid
flowchart LR
    ACT_Technician(["Technician"]):::act
    EVT_MuseumDetailsChanged["Museum details changed"]:::evt
    EVT_LogoReplaced["Logo replaced"]:::evt
    EVT_LegalTextsChanged["Legal texts changed"]:::evt
    ACT_Visitor(["Visitor"]):::act
    EVT_ProblemReported["⭐ Problem reported"]:::evt
    ACT_Technician --> EVT_MuseumDetailsChanged
    EVT_MuseumDetailsChanged --> EVT_LogoReplaced
    EVT_LogoReplaced --> EVT_LegalTextsChanged
    EVT_LegalTextsChanged --> ACT_Visitor
    ACT_Visitor --> EVT_ProblemReported
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

### AI assessment of a defect

Feature ai-assessment (2026-10-31). A technician saves the OpenRouter key and two models; the files of the machines and machine models are indexed for AI in the background. A team member who may work on an open defect asks for an AI assessment with an optional note and photos; it is written in the background and kept with the defect.

```mermaid
flowchart LR
    ACT_Technician(["Technician"]):::act
    EVT_AiSettingsChanged["AI settings changed"]:::evt
    EVT_FileIndexedForAi["File indexed for AI"]:::evt
    ACT_TeamMember(["Team member"]):::act
    EVT_AiAssessmentRequested["⭐ AI assessment requested"]:::evt
    EXT_OpenRouter[["OpenRouter"]]:::ext
    EVT_AiAssessmentWritten["AI assessment written"]:::evt
    ACT_Technician --> EVT_AiSettingsChanged
    EVT_AiSettingsChanged --> EVT_FileIndexedForAi
    EVT_FileIndexedForAi --> ACT_TeamMember
    ACT_TeamMember --> EVT_AiAssessmentRequested
    EVT_AiAssessmentRequested --> EXT_OpenRouter
    EXT_OpenRouter --> EVT_AiAssessmentWritten
    classDef evt fill:#a3391f,stroke:#e65100,color:#fff
    classDef cmd fill:#64b5f6,stroke:#0d47a1,color:#000
    classDef pol fill:#ce93d8,stroke:#4a148c,color:#000
    classDef rm fill:#81c784,stroke:#1b5e20,color:#000
    classDef act fill:#a3751f,stroke:#f57f17,color:#000
    classDef ext fill:#f48fb1,stroke:#880e4f,color:#000
    classDef agg fill:#ffe082,stroke:#ff6f00,color:#000
    classDef hs fill:#e57373,stroke:#b71c1c,color:#fff
```

## Bounded Contexts & Aggregates

| Context | Purpose | Aggregates | Events |
|---|---|---|---|
| Collection (`BC-Collection`) | Which machines the museum has, what they are, where they stand, whether they are playable, and their files – and how the museum presents itself to visitors (museum settings) | Machine, Machine model, File, Museum settings | Machine model created, Machine registered, Machine status changed, Machine moved, Machine details corrected, Machine model corrected, File attached, File removed, Machine retired, Museum details changed, Logo replaced, Logo removed, Legal texts changed |
| Repair (`BC-Repair`) | From problem reports via triage to defects that are worked on and resolved | Problem report, Defect | Problem reported, Defect recorded, Problem report linked to defect, Problem resolved on the spot, Problem report dismissed, Defect prioritized, Defect details changed, Defect claimed, Defect claim released, Work logged, Defect put on hold, Defect resumed, Defect resolved, Defect reopened, Defect closed on retirement |
| Team (`BC-Team`) | Generic, not modelled – team member accounts, roles (helper, technician), signing in and last visit; supplier to all other contexts | – | – |
| Maintenance (`BC-Maintenance`) | The maintenance plan and keeping every machine's scheduled maintenance up to date | Maintenance plan, Maintenance record | Maintenance plan changed, Machines of maintenance task changed, Maintenance task due, Maintenance task overdue, Maintenance recorded |
| AI assistance (`BC-AiAssistance`) | Asking an AI for help with open defects – the AI settings, the AI index of the machines' and machine models' files, and the AI assessments of defects (feature ai-assessment, 2026-10-31; HS-28). Supporting, downstream of Collection, Repair and Team; the only context that talks to OpenRouter (EXT-OpenRouter), behind an anti-corruption layer | AI settings, AI index entry, AI assessment | AI settings changed, File indexed for AI, File indexing failed, File left the AI index, AI work left unfinished, AI assessment requested, AI assessment written, AI assessment failed |

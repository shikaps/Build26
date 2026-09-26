function activeTaskCount(tasks, memberId) {
  return tasks.filter((task) => task.assigneeId === memberId && task.status !== "Done").length;
}

export const mockAiService = {
  async getAssignmentRecommendations({ tasks, members, memberIds, deadline }) {
    const candidates = members
      .filter((member) => memberIds.includes(member.id))
      .map((member) => ({
        memberId: member.id,
        activeTasks: activeTaskCount(tasks, member.id),
      }))
      .sort((first, second) => first.activeTasks - second.activeTasks || first.memberId.localeCompare(second.memberId));

    if (!candidates.length) {
      throw new Error("Select at least one team member to get a recommendation.");
    }

    const daysLeft = deadline
      ? Math.max(0, Math.ceil((new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString())) / 86400000))
      : null;

    return candidates.map((candidate) => {
      const name = members.find((member) => member.id === candidate.memberId)?.name || "This teammate";
      const workload = candidate.activeTasks === 1 ? "active task" : "active tasks";
      const time = daysLeft === null ? "room to plan the work" : daysLeft >= 7
        ? `enough time to finish before the deadline (${daysLeft} days away)`
        : daysLeft === 0 ? "a deadline of today" : `${daysLeft} days before the deadline`;
      const workloadContext = candidate.activeTasks === candidates[0].activeTasks
        ? "one of the lighter workloads"
        : "a manageable workload";
      return {
        ...candidate,
        reason: `${name} currently has ${candidate.activeTasks} ${workload} (${workloadContext}) and has ${time}.`,
      };
    });
  },
};

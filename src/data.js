const today = new Date();
const daysFromNow = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const initialData = {
  currentUser: { id: "u1", name: "Alex Morgan", initials: "AM", email: "alex.morgan@campus.edu" },
  members: [
    { id: "u1", name: "Alex Morgan", initials: "AM", color: "violet" },
    { id: "u2", name: "Maya Chen", initials: "MC", color: "peach" },
    { id: "u3", name: "Jordan Lee", initials: "JL", color: "blue" },
    { id: "u4", name: "Sam Rivera", initials: "SR", color: "mint" },
  ],
  projects: [
    {
      id: "p1",
      name: "Campus sustainability",
      description: "A student-led proposal for a greener, more sustainable campus.",
      deadline: daysFromNow(18),
      memberIds: ["u1", "u2", "u3", "u4"],
      color: "green",
      initials: "CS",
    },
    {
      id: "p2",
      name: "Design systems study",
      description: "Researching the building blocks behind thoughtful digital products.",
      deadline: daysFromNow(31),
      memberIds: ["u1", "u2", "u3"],
      color: "lavender",
      initials: "DS",
    },
  ],
  tasks: [
    { id: "t1", title: "Research campus energy use", projectId: "p1", assigneeId: "u2", priority: "High", status: "In Progress", dueDate: daysFromNow(2), description: "Gather current usage data and identify the biggest opportunities." },
    { id: "t2", title: "Draft survey questions", projectId: "p1", assigneeId: "u1", priority: "Medium", status: "To Do", dueDate: daysFromNow(4), description: "Prepare a short survey for students and campus staff." },
    { id: "t3", title: "Interview facilities team", projectId: "p1", assigneeId: "u3", priority: "High", status: "In Progress", dueDate: daysFromNow(6), description: "Understand existing sustainability programs and constraints." },
    { id: "t4", title: "Create presentation outline", projectId: "p1", assigneeId: "u4", priority: "Low", status: "To Do", dueDate: daysFromNow(9), description: "Map the key story and sections for the final presentation." },
    { id: "t5", title: "Review competitor platforms", projectId: "p2", assigneeId: "u2", priority: "Medium", status: "Done", dueDate: daysFromNow(-1), description: "Compare patterns from three student project tools." },
    { id: "t6", title: "Map core components", projectId: "p2", assigneeId: "u1", priority: "High", status: "In Progress", dueDate: daysFromNow(5), description: "Document the essential components for the study." },
    { id: "t7", title: "Share first research notes", projectId: "p1", assigneeId: "u2", priority: "Low", status: "To Do", dueDate: daysFromNow(11), description: "Post early findings for the team to review." },
    { id: "t8", title: "Review campus transport options", projectId: "p1", assigneeId: "u2", priority: "Medium", status: "To Do", dueDate: daysFromNow(8), description: "Compare current transport modes and their environmental impact." },
    { id: "t9", title: "Collect recycling program data", projectId: "p1", assigneeId: "u2", priority: "Low", status: "In Progress", dueDate: daysFromNow(12), description: "Document campus recycling participation and collection points." },
    { id: "t10", title: "Summarize student feedback", projectId: "p1", assigneeId: "u2", priority: "Medium", status: "To Do", dueDate: daysFromNow(14), description: "Turn survey responses into a short set of themes." },
    { id: "t11", title: "Draft sustainability recommendations", projectId: "p1", assigneeId: "u2", priority: "High", status: "To Do", dueDate: daysFromNow(16), description: "Prepare practical recommendations based on the research." },
  ],
};

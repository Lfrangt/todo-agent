import SwiftUI

struct CalendarView: View {
    @EnvironmentObject var taskViewModel: TaskViewModel
    @State private var selectedDate = Date()
    
    var tasksForSelectedDate: [TodoTask] {
        taskViewModel.tasks.filter { task in
            guard let dueDate = task.dueDate else { return false }
            return Calendar.current.isDate(dueDate, inSameDayAs: selectedDate)
        }
    }
    
    var body: some View {
        VStack(spacing: 20) {
            // 标题
            HStack {
                Text("📅 日历")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal)
            
            // 日历
            DatePicker(
                "选择日期",
                selection: $selectedDate,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .accentColor(Color(red: 0.2, green: 0.8, blue: 0.7))
            .colorScheme(.dark)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.05))
            )
            .padding(.horizontal)
            
            // 选中日期的任务
            VStack(alignment: .leading, spacing: 12) {
                Text(formatDate(selectedDate))
                    .font(.headline)
                    .foregroundColor(.white)
                
                if tasksForSelectedDate.isEmpty {
                    Text("这一天没有任务")
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 30)
                } else {
                    ForEach(tasksForSelectedDate) { task in
                        CalendarTaskRow(task: task)
                    }
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.05))
            )
            .padding(.horizontal)
            
            Spacer()
        }
        .padding(.top)
        .padding(.bottom, 100)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.06, blue: 0.12),
                    Color(red: 0.06, green: 0.08, blue: 0.16)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
    }
    
    func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M月d日 EEEE"
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: date)
    }
}

struct CalendarTaskRow: View {
    let task: TodoTask
    @EnvironmentObject var taskViewModel: TaskViewModel
    
    var body: some View {
        HStack {
            Button(action: { taskViewModel.toggleComplete(task) }) {
                Image(systemName: task.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(task.completed ? .green : .gray)
            }
            
            Text(task.text)
                .foregroundColor(task.completed ? .gray : .white)
                .strikethrough(task.completed)
            
            Spacer()
            
            Text(task.category.icon)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    CalendarView()
        .environmentObject(TaskViewModel())
}


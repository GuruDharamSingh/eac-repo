package ca.signalwatch

enum class Status(val label: String) {
    GOOD("Service is good"),
    WEAK("Service is weak"),
    NONE("No service"),
    UNKNOWN("Checking…");

    companion object {
        fun of(name: String?): Status = entries.firstOrNull { it.name == name } ?: UNKNOWN
    }
}

package model

type MealType string

const (
	MealTypeBreakfast MealType = "breakfast"
	MealTypeLunch     MealType = "lunch"
	MealTypeDinner    MealType = "dinner"
	MealTypeSnack     MealType = "snack"
)

var MealTypes = []MealType{
	MealTypeBreakfast,
	MealTypeLunch,
	MealTypeDinner,
	MealTypeSnack,
}

func IsValidMealType(mealType string) bool {
	for _, mt := range MealTypes {
		if string(mt) == mealType {
			return true
		}
	}
	return false
}

type MuscleGroup string

const (
	MuscleChest      MuscleGroup = "chest"
	MuscleBack       MuscleGroup = "back"
	MuscleShoulders  MuscleGroup = "shoulders"
	MuscleBiceps     MuscleGroup = "biceps"
	MuscleTriceps    MuscleGroup = "triceps"
	MuscleForearms   MuscleGroup = "forearms"
	MuscleAbs        MuscleGroup = "abs"
	MuscleQuads      MuscleGroup = "quads"
	MuscleHamstrings MuscleGroup = "hamstrings"
	MuscleGlutes     MuscleGroup = "glutes"
	MuscleCalves     MuscleGroup = "calves"
	MuscleTraps      MuscleGroup = "traps"
)

var MuscleGroups = []MuscleGroup{
	MuscleChest,
	MuscleBack,
	MuscleShoulders,
	MuscleBiceps,
	MuscleTriceps,
	MuscleForearms,
	MuscleAbs,
	MuscleQuads,
	MuscleHamstrings,
	MuscleGlutes,
	MuscleCalves,
	MuscleTraps,
}

func IsValidMuscleGroup(group string) bool {
	for _, mg := range MuscleGroups {
		if string(mg) == group {
			return true
		}
	}
	return false
}

use std::cmp::Ordering;

pub fn compare_naturally(left: &str, right: &str) -> Ordering {
    let left_folded = left.to_lowercase();
    let right_folded = right.to_lowercase();
    let left_bytes = left_folded.as_bytes();
    let right_bytes = right_folded.as_bytes();
    let mut left_index = 0;
    let mut right_index = 0;

    while left_index < left_bytes.len() && right_index < right_bytes.len() {
        if left_bytes[left_index].is_ascii_digit() && right_bytes[right_index].is_ascii_digit() {
            let (left_end, left_number) = number_chunk(left_bytes, left_index);
            let (right_end, right_number) = number_chunk(right_bytes, right_index);

            let number_order = compare_number_chunks(left_number, right_number);
            if number_order != Ordering::Equal {
                return number_order;
            }

            left_index = left_end;
            right_index = right_end;
            continue;
        }

        let byte_order = left_bytes[left_index].cmp(&right_bytes[right_index]);
        if byte_order != Ordering::Equal {
            return byte_order;
        }

        left_index += 1;
        right_index += 1;
    }

    left_bytes
        .len()
        .cmp(&right_bytes.len())
        .then_with(|| left.cmp(right))
}

fn number_chunk(bytes: &[u8], start: usize) -> (usize, &[u8]) {
    let mut end = start;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
    }
    (end, &bytes[start..end])
}

fn compare_number_chunks(left: &[u8], right: &[u8]) -> Ordering {
    let left_trimmed = trim_leading_zeroes(left);
    let right_trimmed = trim_leading_zeroes(right);

    left_trimmed
        .len()
        .cmp(&right_trimmed.len())
        .then_with(|| left_trimmed.cmp(right_trimmed))
        .then_with(|| left.len().cmp(&right.len()))
}

fn trim_leading_zeroes(value: &[u8]) -> &[u8] {
    let first_non_zero = value
        .iter()
        .position(|byte| *byte != b'0')
        .unwrap_or(value.len().saturating_sub(1));
    &value[first_non_zero..]
}

#[cfg(test)]
mod tests {
    use super::compare_naturally;

    #[test]
    fn sorts_numbered_names_for_humans() {
        let mut names = vec!["10.mp3", "02.mp3", "1.mp3", "2.mp3"];
        names.sort_by(|left, right| compare_naturally(left, right));

        assert_eq!(names, vec!["1.mp3", "2.mp3", "02.mp3", "10.mp3"]);
    }

    #[test]
    fn ignores_case_before_using_a_stable_tie_breaker() {
        let mut names = vec!["b.mp3", "A.mp3", "a.mp3"];
        names.sort_by(|left, right| compare_naturally(left, right));

        assert_eq!(names, vec!["A.mp3", "a.mp3", "b.mp3"]);
    }
}

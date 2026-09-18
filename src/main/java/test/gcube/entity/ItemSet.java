package test.gcube.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 세트. 구성품은 {@link ItemSetComponent} 가 들고 있다.
 */
@Entity
@Table(
        name = "item_set",
        uniqueConstraints = @UniqueConstraint(name = "UK_ITEM_SET_CODE", columnNames = "code")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ItemSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    /** 세트 코드 (예: SET-Z10-DMN-Q) */
    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Builder
    public ItemSet(String code) {
        this.code = code;
    }
}
